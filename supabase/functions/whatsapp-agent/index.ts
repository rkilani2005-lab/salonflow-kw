import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentRequest {
  phoneNumber: string;
  messageContent: string;
  messageType: "text" | "voice";
  audioUrl?: string;
  messageId?: string;
  timestamp?: string;
  tenantId?: string;
  simulatorMode?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL             = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY          = Deno.env.get("LOVABLE_API_KEY");
  const WHATSAPP_BUSINESS_TOKEN  = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LOVABLE_API_KEY) {
    console.error("Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const request: AgentRequest = await req.json();
    const { phoneNumber, messageContent, messageType, audioUrl, tenantId, simulatorMode } = request;

    console.log(`Processing message from ${phoneNumber}: ${messageContent}`);

    // ── Find tenant config ────────────────────────────────────
    let config: any;
    let effectiveTenantId = tenantId;

    if (simulatorMode && tenantId) {
      const { data: configData } = await supabase
        .from("whatsapp_config").select("*").eq("tenant_id", tenantId).single();
      config = configData;
    } else {
      const { data: configs } = await supabase
        .from("whatsapp_config").select("*").eq("is_enabled", true);
      if (configs) {
        for (const c of configs) {
          const isOwner = c.owner_phone_numbers?.includes(phoneNumber);
          const isStaff = c.staff_phone_numbers?.includes(phoneNumber);
          if (isOwner || isStaff) { config = c; effectiveTenantId = c.tenant_id; break; }
        }
        if (!config && configs.length > 0) {
          config = configs[0];
          effectiveTenantId = configs[0].tenant_id;
        }
      }
    }

    if (!effectiveTenantId) {
      return new Response(JSON.stringify({
        error: "No WhatsApp configuration found",
        reply: "Sorry, this service is not configured. Please contact support.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isOwner = config?.owner_phone_numbers?.includes(phoneNumber) || simulatorMode;
    const isStaff = config?.staff_phone_numbers?.includes(phoneNumber);
    const isAdmin = isOwner || isStaff;
    const conversationType = isAdmin ? "admin" : "customer";

    // ── Get or create conversation ────────────────────────────
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("tenant_id", effectiveTenantId)
      .eq("phone_number", phoneNumber)
      .single();

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from("whatsapp_conversations")
        .insert({
          tenant_id: effectiveTenantId,
          phone_number: phoneNumber,
          conversation_type: conversationType,
          conversation_state: {},
        })
        .select().single();
      conversation = newConversation;
    }

    // ── Save incoming message ─────────────────────────────────
    const detectedLanguage = detectLanguage(messageContent);
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation?.id,
      direction: "inbound",
      message_content: messageContent,
      detected_language: detectedLanguage,
      message_type: messageType,
      original_audio_url: audioUrl || null,
      transcription: messageType === "voice" ? messageContent : null,
      metadata: {},
    });

    // ── Get message history ───────────────────────────────────
    const { data: messageHistory } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation?.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // ── Build context ─────────────────────────────────────────
    const contextData = await buildContext(supabase, effectiveTenantId, isAdmin);

    // ── Generate AI response ─────────────────────────────────
    // Pass supabase + tenantId so tool handlers can write to DB
    const aiResponse = await generateAIResponse(
      LOVABLE_API_KEY,
      messageContent,
      detectedLanguage,
      isAdmin,
      contextData,
      messageHistory || [],
      conversation?.conversation_state || {},
      supabase,
      effectiveTenantId
    );

    // ── Save outgoing message ─────────────────────────────────
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation?.id,
      direction: "outbound",
      message_content: aiResponse.reply,
      detected_language: detectedLanguage,
      message_type: aiResponse.messageType || "text",
      metadata: aiResponse.metadata || {},
    });

    // ── Update conversation state ─────────────────────────────
    if (aiResponse.newState) {
      await supabase.from("whatsapp_conversations").update({
        conversation_state: aiResponse.newState,
        last_message_at: new Date().toISOString(),
        needs_human_intervention: aiResponse.needsHuman || false,
        intervention_reason: aiResponse.interventionReason || null,
      }).eq("id", conversation?.id);
    }

    // ── Send via WhatsApp if not simulator ────────────────────
    if (!simulatorMode && WHATSAPP_BUSINESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      await sendWhatsAppMessage(
        WHATSAPP_BUSINESS_TOKEN,
        WHATSAPP_PHONE_NUMBER_ID,
        phoneNumber,
        aiResponse.reply
      );
    }

    return new Response(JSON.stringify({
      success: true,
      reply: aiResponse.reply,
      language: detectedLanguage,
      conversationType,
      metadata: aiResponse.metadata,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Agent error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────

function detectLanguage(text: string): "en" | "ar" {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text) ? "ar" : "en";
}

async function buildContext(supabase: any, tenantId: string, isAdmin: boolean) {
  const context: any = { tenantId };

  const { data: services } = await supabase
    .from("services").select("*").eq("is_active", true);
  context.services = services || [];

  const { data: staff } = await supabase
    .from("staff").select("*").eq("is_active", true);
  context.staff = staff || [];

  // Get first active branch for booking
  const { data: branches } = await supabase
    .from("branches").select("*").eq("tenant_id", tenantId).eq("is_active", true).limit(1);
  context.branch = branches?.[0] || null;

  const today = new Date().toISOString().split("T")[0];
  const { data: todayBookings } = await supabase
    .from("bookings").select("*")
    .gte("booking_date", today)
    .order("booking_date", { ascending: true })
    .limit(50);
  context.upcomingBookings = todayBookings || [];

  if (isAdmin) {
    const { data: revenueData } = await supabase
      .from("bookings")
      .select("price, booking_date, status, service_name, client_name")
      .eq("status", "completed")
      .gte("booking_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    context.revenueData = revenueData || [];

    const { data: expenses } = await supabase
      .from("expenses").select("*").eq("tenant_id", tenantId)
      .gte("expense_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    context.expenses = expenses || [];

    const { data: clients } = await supabase
      .from("clients").select("*").eq("tenant_id", tenantId);
    context.clients = clients || [];
  }

  return context;
}

async function generateAIResponse(
  apiKey: string,
  message: string,
  language: "en" | "ar",
  isAdmin: boolean,
  context: any,
  history: any[],
  currentState: any,
  supabase: any,
  tenantId: string
) {
  const systemPrompt = isAdmin
    ? buildAdminSystemPrompt(language, context)
    : buildCustomerSystemPrompt(language, context);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.message_content,
    })),
    { role: "user", content: message },
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: isAdmin ? getAdminTools() : getCustomerTools(),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const assistantMessage = data.choices?.[0]?.message;

  if (assistantMessage?.tool_calls) {
    // ── Now passing supabase + tenantId into processToolCalls ──
    const toolResults = await processToolCalls(
      assistantMessage.tool_calls,
      context,
      currentState,
      supabase,
      tenantId
    );
    return {
      reply: toolResults.reply,
      messageType: toolResults.messageType || "text",
      metadata: toolResults.metadata,
      newState: toolResults.newState,
      needsHuman: toolResults.needsHuman,
      interventionReason: toolResults.interventionReason,
    };
  }

  return {
    reply: assistantMessage?.content || getDefaultReply(language),
    messageType: "text",
    metadata: {},
    newState: currentState,
  };
}

// ── Tool handlers (the actual DB work happens here) ───────────

async function processToolCalls(
  toolCalls: any[],
  context: any,
  currentState: any,
  supabase: any,
  tenantId: string
) {
  for (const call of toolCalls) {
    const functionName = call.function?.name;
    let args: any = {};
    try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}

    // ── get_revenue_report ────────────────────────────────────
    if (functionName === "get_revenue_report") {
      const period = args.period || "today";
      const today = new Date();
      const startDate = period === "today" ? today
        : period === "week"  ? new Date(today.getTime() - 7  * 86400000)
        :                      new Date(today.getTime() - 30 * 86400000);

      const relevant = context.revenueData?.filter((b: any) =>
        new Date(b.booking_date) >= startDate) || [];
      const total = relevant.reduce((s: number, b: any) => s + (b.price || 0), 0);
      const count = relevant.length;

      return {
        reply: `📊 *Revenue Report (${period})*\n\n💰 Total: ${total} KWD\n📅 Appointments: ${count}\n💵 Avg: ${count > 0 ? (total / count).toFixed(3) : "0.000"} KWD`,
        messageType: "report",
        metadata: { type: "revenue", period, total, count },
        newState: currentState,
      };
    }

    // ── get_top_clients ───────────────────────────────────────
    if (functionName === "get_top_clients") {
      const top = [...(context.clients || [])]
        .sort((a: any, b: any) => (b.visit_count || 0) - (a.visit_count || 0))
        .slice(0, args.limit || 5);
      const list = top.map((c: any, i: number) => `${i + 1}. ${c.name} — ${c.visit_count || 0} visits`).join("\n");
      return {
        reply: `👑 *Top Clients*\n\n${list || "No data yet."}`,
        messageType: "text",
        metadata: {},
        newState: currentState,
      };
    }

    // ── check_availability ────────────────────────────────────
    // FIXED: queries real bookings to find free slots
    if (functionName === "check_availability") {
      const serviceName = args.service_name || "";
      const service = context.services?.find((s: any) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );
      const duration = service?.duration || 60;

      // Build next 3 working days
      const slots: string[] = [];
      const now = new Date();
      let checkDate = new Date(now);

      while (slots.length < 3) {
        checkDate.setDate(checkDate.getDate() + 1);
        const dateStr = checkDate.toISOString().split("T")[0];
        const dayBookings = context.upcomingBookings?.filter(
          (b: any) => b.booking_date === dateStr && !["cancelled", "no_show"].includes(b.status)
        ) || [];

        // Try hours 9–20 in 30-min steps
        for (let h = 9; h < 20 && slots.length < 3; h++) {
          for (const m of [0, 30]) {
            const startMin = h * 60 + m;
            const endMin   = startMin + duration;
            const timeStr  = `${h.toString().padStart(2,"0")}:${m === 0 ? "00" : "30"}`;

            // Check no overlap with existing bookings
            const busy = dayBookings.some((b: any) => {
              const bStart = toMinutes(b.start_time);
              const bEnd   = toMinutes(b.end_time);
              return startMin < bEnd && endMin > bStart;
            });

            if (!busy) {
              const d = new Date(checkDate);
              const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
              slots.push(`${label} at ${timeStr}`);
            }
          }
        }
      }

      const svcLabel = service?.name || serviceName;
      const lines = slots.map((s, i) => `${["1️⃣","2️⃣","3️⃣"][i]} ${s}`).join("\n");

      return {
        reply: `Great choice! Here are available slots for *${svcLabel}* (${duration} min):\n\n${lines}\n\nWhich slot works for you? 😊`,
        messageType: "booking_offer",
        metadata: { slots, service: svcLabel, duration },
        newState: { ...currentState, step: "select_slot", service: svcLabel, serviceId: service?.id, serviceDuration: duration, servicePrice: service?.price },
      };
    }

    // ── create_booking ────────────────────────────────────────
    // FIXED: actually writes to clients + bookings tables
    if (functionName === "create_booking") {
      const clientName  = args.client_name  || "Guest";
      const clientPhone = args.client_phone || "";
      const serviceName = args.service_name || currentState?.service || "";
      const dateStr     = args.date || new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const timeStr     = args.time || "10:00";

      // Normalise time to HH:MM
      const timeParts = timeStr.match(/(\d{1,2}):(\d{2})/);
      const startTime = timeParts
        ? `${timeParts[1].padStart(2,"0")}:${timeParts[2]}`
        : "10:00";

      // Look up service from context or DB
      let service = context.services?.find((s: any) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase())
      );
      if (!service && currentState?.serviceId) {
        service = context.services?.find((s: any) => s.id === currentState.serviceId);
      }

      const duration = service?.duration || currentState?.serviceDuration || 60;
      const price    = service?.price    || currentState?.servicePrice    || 0;
      const [endH, endM] = (() => {
        const [sh, sm] = startTime.split(":").map(Number);
        const total = sh * 60 + sm + duration;
        return [Math.floor(total / 60), total % 60];
      })();
      const endTime = `${endH.toString().padStart(2,"0")}:${endM.toString().padStart(2,"0")}`;

      // Pick first available staff
      const staffMember = context.staff?.[0];

      // 1. Find or create client record
      let clientId: string | null = null;
      if (clientPhone) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("phone", clientPhone)
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient, error: clientErr } = await supabase
            .from("clients")
            .insert({
              tenant_id: tenantId,
              name:       clientName,
              phone:      clientPhone,
              tier:       "normal",
            })
            .select("id")
            .single();

          if (clientErr) {
            console.error("Error creating client:", clientErr);
          } else {
            clientId = newClient.id;
          }
        }
      }

      // 2. Create booking
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .insert({
          tenant_id:        tenantId,
          client_id:        clientId,
          client_name:      clientName,
          client_phone:     clientPhone,
          staff_id:         staffMember?.id || null,
          service_id:       service?.id || null,
          service_name:     service?.name || serviceName,
          service_category: service?.category || "other",
          booking_date:     dateStr,
          start_time:       startTime,
          end_time:         endTime,
          duration,
          price,
          status:           "confirmed",
          notes:            "Booked via WhatsApp AI Agent",
        })
        .select("id")
        .single();

      if (bookingErr) {
        console.error("Error creating booking:", bookingErr);
        return {
          reply: `Sorry, I had trouble saving the booking. Please call us directly or try again. 🙏`,
          messageType: "text",
          metadata: {},
          newState: currentState,
        };
      }

      console.log(`✅ Booking created: ${booking.id} for ${clientName} on ${dateStr} at ${startTime}`);

      const dateLabel = new Date(dateStr).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long"
      });

      return {
        reply: `✅ *Booking Confirmed!*\n\nHi ${clientName}! Your appointment is all set:\n\n📋 *Service:* ${service?.name || serviceName}\n📅 *Date:* ${dateLabel}\n🕐 *Time:* ${startTime}\n${staffMember ? `💇‍♀️ *Stylist:* ${staffMember.name}\n` : ""}💰 *Price:* ${Number(price).toFixed(3)} KWD\n\nWe look forward to seeing you! Reply if you need to make any changes. 😊`,
        messageType: "booking_confirmed",
        metadata: { bookingId: booking.id, clientId, date: dateStr, time: startTime },
        newState: { ...currentState, step: "booked", bookingId: booking.id },
      };
    }

    // ── request_human ─────────────────────────────────────────
    if (functionName === "request_human") {
      return {
        reply: "I'm connecting you with our team right away. They'll respond shortly! 🙏\n\nسأوصلك بفريقنا الآن. سيردون عليك قريباً!",
        messageType: "handoff",
        newState: currentState,
        needsHuman: true,
        interventionReason: args.reason || "Customer requested human assistance",
      };
    }
  }

  return {
    reply: "I understand. How can I help you further?",
    messageType: "text",
    newState: currentState,
  };
}

// ── System prompts ─────────────────────────────────────────────

function buildAdminSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const today = new Date().toISOString().split("T")[0];
  const todayRevenue = context.revenueData?.filter((b: any) => b.booking_date === today)
    ?.reduce((s: number, b: any) => s + (b.price || 0), 0) || 0;
  const todayApts = context.upcomingBookings?.filter((b: any) => b.booking_date === today)?.length || 0;

  return `You are ZAINA, the AI business intelligence assistant for a salon. Respond in ${lang}.

TODAY (${today}): Revenue: ${todayRevenue} KWD · Appointments: ${todayApts}
Staff: ${context.staff?.length || 0} · Clients: ${context.clients?.length || 0}
Services: ${context.services?.map((s: any) => `${s.name}: ${s.price} KWD`).join(", ")}

Use tools to answer questions about revenue, bookings, top clients, popular services.
Format numbers with KWD currency. Use emojis for readability.`;
}

function buildCustomerSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const servicesList = context.services
    ?.map((s: any) => `- ${s.name}${s.name_ar ? ` (${s.name_ar})` : ""}: ${s.price} KWD, ${s.duration} min`)
    .join("\n") || "No services available";

  return `You are ZAINA, the friendly booking assistant for a salon. You MUST respond in ${lang}.

AVAILABLE SERVICES:
${servicesList}

AVAILABLE STAFF: ${context.staff?.map((s: any) => s.name).join(", ") || "Any available stylist"}

YOUR ROLE:
1. Help customers book appointments — ALWAYS use the create_booking tool to save to the database
2. Answer questions about services, prices, availability
3. Use check_availability to show real open slots before booking
4. If you cannot help after 2 attempts, use request_human

BOOKING FLOW:
1. Ask which service they want
2. Call check_availability to show real open time slots
3. Get client name and phone number
4. Call create_booking with ALL details — this is MANDATORY to save the booking
5. Confirm with the booking details

CRITICAL: You MUST call the create_booking tool to save. Just saying "your booking is confirmed" without calling the tool does NOT save anything.

Be warm, professional, use emojis sparingly (💇‍♀️ 💅 ✨).`;
}

// ── Tool definitions ──────────────────────────────────────────

function getAdminTools() {
  return [
    { type: "function", function: { name: "get_revenue_report", description: "Generate revenue report", parameters: { type: "object", properties: { period: { type: "string", enum: ["today","week","month"] } }, required: ["period"] } } },
    { type: "function", function: { name: "get_top_clients",    description: "Get top clients by visits", parameters: { type: "object", properties: { limit: { type: "number" } } } } },
  ];
}

function getCustomerTools() {
  return [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check real available appointment slots for a service",
        parameters: {
          type: "object",
          properties: {
            service_name:   { type: "string", description: "Name of the service" },
            preferred_date: { type: "string", description: "Preferred date YYYY-MM-DD (optional)" },
          },
          required: ["service_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: "SAVE a confirmed appointment to the database. MUST be called to actually create the booking.",
        parameters: {
          type: "object",
          properties: {
            service_name:  { type: "string",  description: "Service name" },
            date:          { type: "string",  description: "Booking date YYYY-MM-DD" },
            time:          { type: "string",  description: "Start time HH:MM" },
            client_name:   { type: "string",  description: "Client full name" },
            client_phone:  { type: "string",  description: "Client phone number" },
          },
          required: ["service_name", "date", "time", "client_name", "client_phone"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "request_human",
        description: "Request human staff assistance",
        parameters: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
    },
  ];
}

// ── Utilities ─────────────────────────────────────────────────

function toMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

async function sendWhatsAppMessage(token: string, phoneNumberId: string, to: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!response.ok) console.error("WhatsApp send error:", await response.text());
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
  }
}

function getDefaultReply(language: "en" | "ar") {
  return language === "ar"
    ? "عذراً، لم أفهم طلبك. هل يمكنك إعادة صياغته؟"
    : "I'm sorry, I didn't understand your request. Could you please rephrase?";
}
