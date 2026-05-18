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

  const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY           = Deno.env.get("LOVABLE_API_KEY");
  const WHATSAPP_BUSINESS_TOKEN   = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
  const WHATSAPP_PHONE_NUMBER_ID  = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

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

    let config: any;
    let effectiveTenantId = tenantId;

    if (simulatorMode && tenantId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return unauthorized();
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) return unauthorized();
      const { data: profile } = await supabase
        .from("profiles").select("tenant_id").eq("user_id", userData.user.id).maybeSingle();
      if (!profile || profile.tenant_id !== tenantId) return forbidden();
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

    const isOwner = simulatorMode
      ? phoneNumber.includes("OWNER")
      : config?.owner_phone_numbers?.includes(phoneNumber);
    const isStaff = simulatorMode ? false : config?.staff_phone_numbers?.includes(phoneNumber);
    const isAdmin = isOwner || isStaff;
    const conversationType = isAdmin ? "admin" : "customer";

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

    const { data: messageHistory } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation?.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const contextData = await buildContext(supabase, effectiveTenantId, isAdmin, phoneNumber);

    const aiResponse = await generateAIResponse(
      LOVABLE_API_KEY!, messageContent, detectedLanguage, isAdmin,
      contextData, messageHistory || [],
      conversation?.conversation_state || {},
      supabase, effectiveTenantId,
      phoneNumber,
    );

    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation?.id,
      direction: "outbound",
      message_content: aiResponse.reply,
      detected_language: detectedLanguage,
      message_type: aiResponse.messageType || "text",
      metadata: aiResponse.metadata || {},
    });

    if (aiResponse.newState) {
      await supabase.from("whatsapp_conversations").update({
        conversation_state: aiResponse.newState,
        last_message_at: new Date().toISOString(),
        needs_human_intervention: aiResponse.needsHuman || false,
        intervention_reason: aiResponse.interventionReason || null,
      }).eq("id", conversation?.id);
    }

    if (!simulatorMode && WHATSAPP_BUSINESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      await sendWhatsAppMessage(
        WHATSAPP_BUSINESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, phoneNumber, aiResponse.reply
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), {
  status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const forbidden = () => new Response(JSON.stringify({ error: "Forbidden" }), {
  status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function detectLanguage(text: string): "en" | "ar" {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text) ? "ar" : "en";
}

function toMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function buildContext(supabase: any, tenantId: string, isAdmin: boolean, phoneNumber: string) {
  const context: any = { tenantId };

  const [{ data: services }, { data: staff }, { data: branches }, { data: bookingConfig }] = await Promise.all([
    supabase.from("services").select("*").eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("staff").select("*").eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("branches").select("*").eq("tenant_id", tenantId).eq("is_active", true).limit(1),
    supabase.from("booking_config").select("*").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  context.services = services || [];
  context.staff = staff || [];
  context.branch = branches?.[0] || null;
  context.bookingConfig = bookingConfig || { advance_booking_days: 30, min_notice_hours: 2 };

  const staffIds = (staff || []).map((s: any) => s.id);
  if (staffIds.length > 0) {
    const { data: links } = await supabase
      .from("staff_services").select("staff_id, service_id").in("staff_id", staffIds);
    context.staffServices = links || [];
  } else {
    context.staffServices = [];
  }

  if (phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, "");
    const candidates = [phoneNumber, `+${digits}`, digits, digits.slice(-8)].filter(Boolean);
    let client: any = null;
    for (const variant of candidates) {
      const { data } = await supabase
        .from("clients").select("id, name, tier, loyalty_points")
        .eq("tenant_id", tenantId)
        .or(`phone.eq.${variant},phone.ilike.%${digits.slice(-8)}`)
        .limit(1).maybeSingle();
      if (data) { client = data; break; }
    }
    context.client = client;

    if (client) {
      const { data: pastBookings } = await supabase
        .from("bookings")
        .select("staff_id, service_id, booking_date")
        .eq("client_id", client.id)
        .in("status", ["completed", "in_service"])
        .order("booking_date", { ascending: false })
        .limit(10);
      context.pastStaffIds = [...new Set((pastBookings || []).map((b: any) => b.staff_id).filter(Boolean))].slice(0, 3);
    } else {
      context.pastStaffIds = [];
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const future = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const { data: upcoming } = await supabase
    .from("bookings").select("staff_id, booking_date, start_time, end_time, status")
    .gte("booking_date", today).lte("booking_date", future)
    .order("booking_date", { ascending: true });
  context.upcomingBookings = upcoming || [];

  if (isAdmin) {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const [{ data: rev }, { data: clients }] = await Promise.all([
      supabase.from("bookings").select("price, booking_date, status, service_name, client_name")
        .eq("status", "completed").gte("booking_date", since),
      supabase.from("clients").select("*").eq("tenant_id", tenantId),
    ]);
    context.revenueData = rev || [];
    context.clients = clients || [];
  }

  return context;
}

function findSlots(opts: {
  service: any;
  staff: any[];
  staffServices: any[];
  bookings: any[];
  preferredStaffId?: string | null;
  minNoticeHours: number;
  maxDaysOut: number;
  limit?: number;
}) {
  const limit = opts.limit ?? 4;
  const duration = opts.service?.duration || 60;
  const stepMin = Math.max(15, Math.min(30, duration > 60 ? 30 : 15));
  const slots: { date: string; time: string; staffId: string; staffName: string }[] = [];
  const now = new Date();
  const earliestUTC = new Date(now.getTime() + opts.minNoticeHours * 3600000);

  const capableStaffIds = new Set(
    opts.staffServices.filter((l: any) => l.service_id === opts.service.id).map((l: any) => l.staff_id)
  );
  let candidateStaff = opts.staff.filter((s: any) => capableStaffIds.has(s.id));
  if (candidateStaff.length === 0) candidateStaff = opts.staff;

  if (opts.preferredStaffId) {
    candidateStaff.sort((a, b) =>
      a.id === opts.preferredStaffId ? -1 : b.id === opts.preferredStaffId ? 1 : 0);
  }

  for (let dayOffset = 0; dayOffset <= opts.maxDaysOut && slots.length < limit; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dateStr = checkDate.toISOString().split("T")[0];

    for (const st of candidateStaff) {
      if (slots.length >= limit) break;
      const startMin = toMinutes(st.working_hours_start || "09:00");
      const endMin   = toMinutes(st.working_hours_end   || "18:00");
      const breakStart = st.break_start ? toMinutes(st.break_start) : null;
      const breakEnd   = st.break_end   ? toMinutes(st.break_end)   : null;

      const stBookings = opts.bookings.filter((b: any) =>
        b.staff_id === st.id &&
        b.booking_date === dateStr &&
        !["cancelled", "no_show"].includes(b.status));

      for (let t = startMin; t + duration <= endMin && slots.length < limit; t += stepMin) {
        if (breakStart !== null && breakEnd !== null && t < breakEnd && t + duration > breakStart) continue;
        if (dayOffset === 0) {
          const slotUTC = new Date(checkDate);
          slotUTC.setHours(Math.floor(t / 60), t % 60, 0, 0);
          if (slotUTC < earliestUTC) continue;
        }
        const busy = stBookings.some((b: any) => {
          const bs = toMinutes(b.start_time), be = toMinutes(b.end_time);
          return t < be && t + duration > bs;
        });
        if (busy) continue;
        slots.push({ date: dateStr, time: fromMinutes(t), staffId: st.id, staffName: st.name });
        if (slots.length >= limit) break;
      }
    }
  }
  return slots;
}

function formatSlotLabel(s: { date: string; time: string; staffName: string }): string {
  const d = new Date(s.date);
  const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  return `${label} at ${s.time} with ${s.staffName}`;
}

async function generateAIResponse(
  apiKey: string, message: string, language: "en" | "ar", isAdmin: boolean,
  context: any, history: any[], currentState: any,
  supabase: any, tenantId: string, phoneNumber: string
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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    return await processToolCalls(
      assistantMessage.tool_calls, context, currentState, supabase, tenantId, phoneNumber
    );
  }

  return {
    reply: assistantMessage?.content || getDefaultReply(language),
    messageType: "text",
    metadata: {},
    newState: currentState,
  };
}

async function processToolCalls(
  toolCalls: any[], context: any, currentState: any,
  supabase: any, tenantId: string, phoneNumber: string,
) {
  for (const call of toolCalls) {
    const fn = call.function?.name;
    let args: any = {};
    try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}

    if (fn === "get_revenue_report") {
      const period = args.period || "today";
      const today = new Date();
      const startDate = period === "today" ? today
        : period === "week"  ? new Date(today.getTime() - 7  * 86400000)
        :                      new Date(today.getTime() - 30 * 86400000);
      const relevant = (context.revenueData || []).filter((b: any) =>
        new Date(b.booking_date) >= startDate);
      const total = relevant.reduce((s: number, b: any) => s + (b.price || 0), 0);
      const count = relevant.length;
      return {
        reply: `📊 *Revenue Report (${period})*\n\n💰 Total: ${total.toFixed(3)} KWD\n📅 Appointments: ${count}\n💵 Avg: ${count > 0 ? (total / count).toFixed(3) : "0.000"} KWD`,
        messageType: "report",
        metadata: { type: "revenue", period, total, count },
        newState: currentState,
      };
    }

    if (fn === "get_top_clients") {
      const top = [...(context.clients || [])]
        .sort((a: any, b: any) => (b.visit_count || 0) - (a.visit_count || 0))
        .slice(0, args.limit || 5);
      const list = top.map((c: any, i: number) => `${i + 1}. ${c.name} — ${c.visit_count || 0} visits`).join("\n");
      return {
        reply: `👑 *Top Clients*\n\n${list || "No data yet."}`,
        messageType: "text", metadata: {}, newState: currentState,
      };
    }

    if (fn === "check_availability") {
      const serviceName = (args.service_name || "").toString();
      const service = context.services?.find((s: any) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
        s.name_ar?.includes(serviceName));
      if (!service) {
        return {
          reply: `I couldn't find a service matching "${serviceName}". Our services are:\n${(context.services || []).map((s: any) => `• ${s.name}`).join("\n")}\n\nWhich one would you like?`,
          messageType: "text", metadata: {}, newState: currentState,
        };
      }

      let preferredStaffId: string | null = null;
      if (args.preferred_staff) {
        const match = (context.staff || []).find((s: any) =>
          s.name.toLowerCase().includes(args.preferred_staff.toLowerCase()) ||
          s.name_ar?.includes(args.preferred_staff));
        if (match) preferredStaffId = match.id;
      }
      if (!preferredStaffId && context.pastStaffIds?.length > 0) {
        preferredStaffId = context.pastStaffIds[0];
      }

      const slots = findSlots({
        service,
        staff: context.staff || [],
        staffServices: context.staffServices || [],
        bookings: context.upcomingBookings || [],
        preferredStaffId,
        minNoticeHours: Number(context.bookingConfig?.min_notice_hours ?? 2),
        maxDaysOut:     Number(context.bookingConfig?.advance_booking_days ?? 14),
        limit: 4,
      });

      if (slots.length === 0) {
        return {
          reply: `Sorry, no openings for *${service.name}* in the next ${context.bookingConfig?.advance_booking_days ?? 14} days. Should I put you on the waiting list, or try a different service?`,
          messageType: "text",
          metadata: { type: "no_slots", service: service.name },
          newState: { ...currentState, step: "no_slots", serviceId: service.id },
          needsHuman: false,
        };
      }

      const lines = slots.map((s, i) => `${["1️⃣","2️⃣","3️⃣","4️⃣"][i]} ${formatSlotLabel(s)}`).join("\n");
      const depositLine = service.deposit_required && service.deposit_amount > 0 && !context.client
        ? `\n\n💳 *Deposit required:* ${Number(service.deposit_amount).toFixed(3)} KWD (refundable, secures your slot)`
        : "";
      const greeting = context.client
        ? `Welcome back, ${context.client.name}! ` + (preferredStaffId && context.pastStaffIds?.includes(preferredStaffId)
            ? `I put your usual stylist first.\n\n`
            : `\n\n`)
        : "";

      return {
        reply: `${greeting}Here are the soonest openings for *${service.name}* (${service.duration} min):\n\n${lines}${depositLine}\n\nReply with the number you'd like (1–${slots.length}).`,
        messageType: "booking_offer",
        metadata: { slots, service: service.name, duration: service.duration },
        newState: {
          ...currentState,
          step: "select_slot",
          service: service.name,
          serviceId: service.id,
          serviceDuration: service.duration,
          servicePrice: service.price,
          serviceDepositRequired: !!service.deposit_required,
          serviceDepositAmount: Number(service.deposit_amount || 0),
          offeredSlots: slots,
          isReturningClient: !!context.client,
        },
      };
    }

    if (fn === "create_booking") {
      const clientName  = args.client_name  || context.client?.name || "Guest";
      const clientPhone = args.client_phone || phoneNumber || "";
      const serviceName = args.service_name || currentState?.service || "";
      const dateStr     = args.date || new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const rawTime     = args.time || "10:00";
      const timeParts   = rawTime.match(/(\d{1,2}):(\d{2})/);
      const startTime   = timeParts ? `${timeParts[1].padStart(2, "0")}:${timeParts[2]}` : "10:00";

      let service = context.services?.find((s: any) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase()));
      if (!service && currentState?.serviceId) {
        service = context.services?.find((s: any) => s.id === currentState.serviceId);
      }
      const duration = service?.duration || currentState?.serviceDuration || 60;
      const price    = service?.price    || currentState?.servicePrice    || 0;
      const [endH, endM] = (() => {
        const [sh, sm] = startTime.split(":").map(Number);
        const tot = sh * 60 + sm + duration;
        return [Math.floor(tot / 60), tot % 60];
      })();
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

      let staffId: string | null = null;
      let staffName: string | null = null;
      if (args.slot_index != null && Array.isArray(currentState?.offeredSlots)) {
        const idx = Number(args.slot_index) - 1;
        if (idx >= 0 && idx < currentState.offeredSlots.length) {
          staffId = currentState.offeredSlots[idx].staffId;
          staffName = currentState.offeredSlots[idx].staffName;
        }
      }
      if (!staffId && args.preferred_staff) {
        const match = (context.staff || []).find((s: any) =>
          s.name.toLowerCase().includes(args.preferred_staff.toLowerCase()));
        if (match) { staffId = match.id; staffName = match.name; }
      }
      if (!staffId) {
        const fallback = (context.staff || [])[0];
        staffId = fallback?.id || null;
        staffName = fallback?.name || null;
      }

      let clientId: string | null = context.client?.id || null;
      if (!clientId && clientPhone) {
        const { data: existing } = await supabase
          .from("clients").select("id")
          .eq("tenant_id", tenantId).eq("phone", clientPhone).maybeSingle();
        if (existing) clientId = existing.id;
        else {
          const { data: newClient, error: clientErr } = await supabase
            .from("clients")
            .insert({ tenant_id: tenantId, name: clientName, phone: clientPhone, tier: "normal" })
            .select("id").single();
          if (clientErr) console.error("Error creating client:", clientErr);
          else clientId = newClient.id;
        }
      }

      const isNew = !context.client;
      const depositRequired = isNew
        && !!service?.deposit_required
        && Number(service?.deposit_amount || 0) > 0;
      const depositAmount = depositRequired ? Number(service.deposit_amount) : 0;

      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .insert({
          client_id:        clientId,
          client_name:      clientName,
          client_phone:     clientPhone,
          staff_id:         staffId,
          service_id:       service?.id || null,
          service_name:     service?.name || serviceName,
          service_category: service?.category || "other",
          booking_date:     dateStr,
          start_time:       startTime,
          end_time:         endTime,
          duration, price,
          status:           depositRequired ? "planned" : "confirmed",
          deposit_amount:   depositAmount,
          deposit_status:   depositRequired ? "pending" : "paid",
          notes:            "Booked via WhatsApp AI Agent",
          is_online_booking: true,
        })
        .select("id").single();

      if (bookingErr) {
        console.error("Error creating booking:", bookingErr);
        return {
          reply: `Sorry, I couldn't save your booking. Could you try again, or reply "human" and our team will help. 🙏`,
          messageType: "text", metadata: {}, newState: currentState,
        };
      }

      let paymentUrl: string | null = null;
      if (depositRequired) {
        try {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/myfatoorah-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "create",
              bookingId: booking.id,
              amount: depositAmount,
              clientName,
              clientPhone,
              serviceName: service?.name || serviceName,
            }),
          });
          const j = await resp.json();
          if (j?.paymentUrl) paymentUrl = j.paymentUrl;
        } catch (e) {
          console.warn("Deposit link creation failed:", e);
        }
      }

      const dateLabel = new Date(dateStr).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      });

      if (depositRequired && paymentUrl) {
        return {
          reply: `📋 *${service?.name || serviceName}*\n📅 ${dateLabel} at ${startTime}\n💇‍♀️ ${staffName ?? "Any stylist"}\n💰 ${Number(price).toFixed(3)} KWD\n\n*To confirm this slot,* please pay the ${depositAmount.toFixed(3)} KWD refundable deposit here:\n\n${paymentUrl}\n\nYour slot is held for 30 minutes. After payment your booking is automatically confirmed. 😊`,
          messageType: "deposit_required",
          metadata: { bookingId: booking.id, clientId, depositAmount, paymentUrl },
          newState: { ...currentState, step: "deposit_pending", bookingId: booking.id },
        };
      }

      return {
        reply: `✅ *Booking Confirmed!*\n\nHi ${clientName}! Your appointment is set:\n\n📋 *Service:* ${service?.name || serviceName}\n📅 *Date:* ${dateLabel}\n🕐 *Time:* ${startTime}\n${staffName ? `💇‍♀️ *Stylist:* ${staffName}\n` : ""}💰 *Price:* ${Number(price).toFixed(3)} KWD\n\nWe look forward to seeing you. Reply if you need to reschedule. 😊`,
        messageType: "booking_confirmed",
        metadata: { bookingId: booking.id, clientId, date: dateStr, time: startTime, staffId },
        newState: { ...currentState, step: "booked", bookingId: booking.id },
      };
    }

    if (fn === "request_human") {
      return {
        reply: "I'm connecting you with our team right away. They'll respond shortly! 🙏\n\nسأوصلك بفريقنا الآن. سيردون عليك قريباً!",
        messageType: "handoff", newState: currentState,
        needsHuman: true, interventionReason: args.reason || "Customer requested human assistance",
      };
    }
  }

  return { reply: "I understand. How can I help you further?", messageType: "text", newState: currentState };
}

function buildAdminSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const today = new Date().toISOString().split("T")[0];
  const todayRevenue = (context.revenueData || []).filter((b: any) => b.booking_date === today)
    .reduce((s: number, b: any) => s + (b.price || 0), 0);
  const todayApts = (context.upcomingBookings || []).filter((b: any) => b.booking_date === today).length;
  return `You are ZAINA, the AI business intelligence assistant for a salon. Respond in ${lang}.

TODAY (${today}): Revenue: ${todayRevenue.toFixed(3)} KWD · Appointments: ${todayApts}
Staff: ${context.staff?.length || 0} · Clients: ${context.clients?.length || 0}
Services: ${context.services?.map((s: any) => `${s.name}: ${s.price} KWD`).join(", ")}

Use tools to answer questions about revenue, bookings, top clients, popular services.
Format numbers with KWD currency. Use emojis for readability.`;
}

function buildCustomerSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const servicesList = (context.services || [])
    .map((s: any) => `- ${s.name}${s.name_ar ? ` (${s.name_ar})` : ""}: ${s.price} KWD, ${s.duration} min${s.deposit_required ? ` [deposit ${s.deposit_amount} KWD for new clients]` : ""}`)
    .join("\n") || "No services available";
  const staffList = (context.staff || []).map((s: any) => s.name).join(", ") || "Any available stylist";

  const clientLine = context.client
    ? `RETURNING CLIENT: ${context.client.name}${context.pastStaffIds?.length ? ` — preferred stylist(s): ${context.pastStaffIds.map((id: string) => (context.staff || []).find((s: any) => s.id === id)?.name).filter(Boolean).join(", ")}` : ""}`
    : `NEW CLIENT (no prior bookings)`;

  return `You are ZAINA, the friendly booking assistant for a salon. You MUST respond in ${lang}.

${clientLine}

AVAILABLE SERVICES:
${servicesList}

AVAILABLE STAFF: ${staffList}

YOUR ROLE:
1. Help customers book appointments — ALWAYS use the create_booking tool to save to the database.
2. Answer questions about services, prices, availability.
3. Use check_availability to show real open slots — it now respects staff working hours, breaks, and which stylists can perform the requested service.
4. If the client has used the salon before, the slot search already prefers their past stylist; you don't need to ask.
5. For NEW clients, if a service has a deposit, the tool will return a payment link — *include it verbatim* in your message.
6. If you cannot help after 2 attempts, use request_human.

BOOKING FLOW:
1. Ask which service they want (skip if the message already implies it).
2. Call check_availability with the service name.
3. When the user picks a slot, call create_booking with slot_index (1-based) — this binds the chosen stylist automatically.
4. If a deposit link comes back, present it.

CRITICAL: You MUST call create_booking to save. Stating "your booking is confirmed" without calling the tool does NOT save anything.

Be warm, concise, professional. Use emojis sparingly (💇‍♀️ 💅 ✨).`;
}

function getAdminTools() {
  return [
    { type: "function", function: { name: "get_revenue_report", description: "Generate revenue report",
      parameters: { type: "object", properties: { period: { type: "string", enum: ["today","week","month"] } }, required: ["period"] } } },
    { type: "function", function: { name: "get_top_clients", description: "Get top clients by visits",
      parameters: { type: "object", properties: { limit: { type: "number" } } } } },
  ];
}

function getCustomerTools() {
  return [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Find real open slots for a service, optionally with a preferred stylist. Already respects working hours, breaks, staff capability.",
        parameters: {
          type: "object",
          properties: {
            service_name:   { type: "string", description: "Name of the service" },
            preferred_staff:{ type: "string", description: "Optional preferred stylist name" },
          },
          required: ["service_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: "Save the booking. Pass slot_index (1-based) referring to the slots returned by check_availability — that binds the correct stylist and date.",
        parameters: {
          type: "object",
          properties: {
            service_name:    { type: "string" },
            slot_index:      { type: "number",  description: "1-based index of the offered slot the customer chose" },
            date:            { type: "string",  description: "YYYY-MM-DD (only if slot_index missing)" },
            time:            { type: "string",  description: "HH:MM (only if slot_index missing)" },
            preferred_staff: { type: "string",  description: "Stylist name (only if slot_index missing)" },
            client_name:     { type: "string" },
            client_phone:    { type: "string" },
          },
          required: ["service_name", "client_name", "client_phone"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "request_human",
        description: "Request human staff assistance",
        parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
      },
    },
  ];
}

async function sendWhatsAppMessage(token: string, phoneNumberId: string, to: string, message: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
    });
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
