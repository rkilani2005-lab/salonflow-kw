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
  tenantId?: string; // For simulator mode
  simulatorMode?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const WHATSAPP_BUSINESS_TOKEN = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
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

    // Find tenant configuration for this phone number (or use provided tenantId for simulator)
    let config;
    let effectiveTenantId = tenantId;

    if (simulatorMode && tenantId) {
      // Simulator mode - use provided tenant ID
      const { data: configData } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();
      config = configData;
    } else {
      // Real webhook - find tenant by phone config
      const { data: configs } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_enabled", true);

      // Find the config where this phone is in owner/staff list, or any enabled tenant for customer
      if (configs) {
        for (const c of configs) {
          const isOwner = c.owner_phone_numbers?.includes(phoneNumber);
          const isStaff = c.staff_phone_numbers?.includes(phoneNumber);
          if (isOwner || isStaff) {
            config = c;
            effectiveTenantId = c.tenant_id;
            break;
          }
        }
        // If not found as owner/staff, use first enabled config (customer)
        if (!config && configs.length > 0) {
          config = configs[0];
          effectiveTenantId = configs[0].tenant_id;
        }
      }
    }

    if (!effectiveTenantId) {
      return new Response(JSON.stringify({ 
        error: "No WhatsApp configuration found",
        reply: "Sorry, this service is not configured. Please contact support."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine if this is an admin (owner/staff) or customer
    const isOwner = config?.owner_phone_numbers?.includes(phoneNumber) || simulatorMode;
    const isStaff = config?.staff_phone_numbers?.includes(phoneNumber);
    const isAdmin = isOwner || isStaff;
    const conversationType = isAdmin ? "admin" : "customer";

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("tenant_id", effectiveTenantId)
      .eq("phone_number", phoneNumber)
      .single();

    if (!conversation) {
      const { data: newConversation, error: createError } = await supabase
        .from("whatsapp_conversations")
        .insert({
          tenant_id: effectiveTenantId,
          phone_number: phoneNumber,
          conversation_type: conversationType,
          conversation_state: {},
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
      }
      conversation = newConversation;
    }

    // Save incoming message
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

    // Get conversation history for context
    const { data: messageHistory } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation?.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build context for AI
    const contextData = await buildContext(supabase, effectiveTenantId, isAdmin);

    // Generate AI response
    const aiResponse = await generateAIResponse(
      LOVABLE_API_KEY,
      messageContent,
      detectedLanguage,
      isAdmin,
      contextData,
      messageHistory || [],
      conversation?.conversation_state || {}
    );

    // Save outgoing message
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation?.id,
      direction: "outbound",
      message_content: aiResponse.reply,
      detected_language: detectedLanguage,
      message_type: aiResponse.messageType || "text",
      metadata: aiResponse.metadata || {},
    });

    // Update conversation state
    if (aiResponse.newState) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          conversation_state: aiResponse.newState,
          last_message_at: new Date().toISOString(),
          needs_human_intervention: aiResponse.needsHuman || false,
          intervention_reason: aiResponse.interventionReason || null,
        })
        .eq("id", conversation?.id);
    }

    // Send reply via WhatsApp (only if not in simulator mode)
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
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Agent error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function detectLanguage(text: string): "en" | "ar" {
  // Simple Arabic detection based on character range
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text) ? "ar" : "en";
}

async function buildContext(supabase: any, tenantId: string, isAdmin: boolean) {
  const context: any = {};

  // Get services
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  context.services = services || [];

  // Get staff
  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  context.staff = staff || [];

  // Get today's bookings
  const today = new Date().toISOString().split("T")[0];
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*")
    .gte("booking_date", today)
    .order("booking_date", { ascending: true })
    .limit(50);
  context.upcomingBookings = todayBookings || [];

  if (isAdmin) {
    // Get revenue data for admin queries
    const { data: revenueData } = await supabase
      .from("bookings")
      .select("price, booking_date, status, service_name, client_name")
      .eq("status", "completed")
      .gte("booking_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    context.revenueData = revenueData || [];

    // Get expenses
    const { data: expenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("expense_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    context.expenses = expenses || [];

    // Get client stats
    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId);
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
  currentState: any
) {
  const systemPrompt = isAdmin
    ? buildAdminSystemPrompt(language, context)
    : buildCustomerSystemPrompt(language, context);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((m) => ({
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

  // Handle tool calls if present
  if (assistantMessage?.tool_calls) {
    const toolResults = await processToolCalls(assistantMessage.tool_calls, context, currentState);
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

function buildAdminSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const today = new Date().toISOString().split("T")[0];
  
  // Calculate today's revenue
  const todayRevenue = context.revenueData
    ?.filter((b: any) => b.booking_date === today)
    ?.reduce((sum: number, b: any) => sum + (b.price || 0), 0) || 0;
  
  const todayAppointments = context.upcomingBookings?.filter((b: any) => b.booking_date === today)?.length || 0;

  return `You are ZAINA, the AI business intelligence assistant for a salon management system. You MUST respond in ${lang}.

CURRENT DATA (${today}):
- Today's Revenue: ${todayRevenue} KWD
- Today's Appointments: ${todayAppointments}
- Total Active Services: ${context.services?.length || 0}
- Total Active Staff: ${context.staff?.length || 0}
- Clients in database: ${context.clients?.length || 0}

RECENT BOOKINGS (last 30 days): ${JSON.stringify(context.revenueData?.slice(0, 20) || [])}
EXPENSES (last 30 days): ${JSON.stringify(context.expenses?.slice(0, 10) || [])}
TOP SERVICES: ${context.services?.map((s: any) => `${s.name}: ${s.price} KWD`).join(", ")}

You can answer questions about:
- Revenue (daily, weekly, monthly summaries)
- Appointments and bookings
- Popular services and staff performance
- Client insights and repeat customers
- Expense tracking

Format financial data clearly with KWD currency. Use emojis for visual appeal (📊 💰 📈 📉).
${language === "ar" ? "Use Arabic numerals and RTL-friendly formatting." : ""}`;
}

function buildCustomerSystemPrompt(language: "en" | "ar", context: any) {
  const lang = language === "ar" ? "Arabic" : "English";
  const servicesList = context.services
    ?.map((s: any) => `- ${s.name}${s.name_ar ? ` (${s.name_ar})` : ""}: ${s.price} KWD, ${s.duration} min`)
    .join("\n") || "No services available";

  return `You are ZAINA, the friendly booking assistant for a salon. You MUST respond in ${lang}.

${language === "ar" ? "أهلاً وسهلاً! أنا زينة، مساعدتك لحجز المواعيد." : "Welcome! I'm ZAINA, your booking assistant."}

AVAILABLE SERVICES:
${servicesList}

AVAILABLE STAFF:
${context.staff?.map((s: any) => s.name).join(", ") || "Any available stylist"}

YOUR TASKS:
1. Help customers book appointments
2. Answer questions about services and prices
3. Help reschedule or cancel existing bookings
4. Provide salon information

BOOKING FLOW:
1. Ask which service they want
2. Ask preferred date and time
3. Offer 2-3 available slots
4. Confirm the booking

Be warm, professional, and helpful. Use emojis sparingly (💇‍♀️ 💅 ✨).
If you cannot understand after 2 attempts, say you'll connect them with a team member.`;
}

function getAdminTools() {
  return [
    {
      type: "function",
      function: {
        name: "get_revenue_report",
        description: "Generate a revenue report for a specific period",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "week", "month"] },
          },
          required: ["period"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_top_clients",
        description: "Get the top customers by visit count",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", default: 5 },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_popular_services",
        description: "Get the most popular services",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", default: 5 },
          },
        },
      },
    },
  ];
}

function getCustomerTools() {
  return [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check available appointment slots",
        parameters: {
          type: "object",
          properties: {
            service_name: { type: "string" },
            preferred_date: { type: "string" },
          },
          required: ["service_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: "Create a new appointment booking",
        parameters: {
          type: "object",
          properties: {
            service_name: { type: "string" },
            date: { type: "string" },
            time: { type: "string" },
            client_name: { type: "string" },
            client_phone: { type: "string" },
          },
          required: ["service_name", "date", "time"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "request_human",
        description: "Request human assistance when unable to help",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
          required: ["reason"],
        },
      },
    },
  ];
}

async function processToolCalls(toolCalls: any[], context: any, currentState: any) {
  // Process tool calls and return appropriate response
  for (const call of toolCalls) {
    const functionName = call.function?.name;
    const args = JSON.parse(call.function?.arguments || "{}");

    if (functionName === "get_revenue_report") {
      const period = args.period;
      const today = new Date();
      let startDate: Date;

      if (period === "today") {
        startDate = today;
      } else if (period === "week") {
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const relevantBookings = context.revenueData?.filter((b: any) => 
        new Date(b.booking_date) >= startDate
      ) || [];

      const totalRevenue = relevantBookings.reduce((sum: number, b: any) => sum + (b.price || 0), 0);
      const count = relevantBookings.length;

      return {
        reply: `📊 *Revenue Report (${period})*\n\n💰 Total Revenue: ${totalRevenue} KWD\n📅 Appointments: ${count}\n💵 Avg per booking: ${count > 0 ? (totalRevenue / count).toFixed(2) : 0} KWD`,
        messageType: "report",
        metadata: { type: "revenue", period, total: totalRevenue, count },
        newState: currentState,
      };
    }

    if (functionName === "request_human") {
      return {
        reply: "I'm connecting you with our team. They'll respond shortly! 🙏\n\nسأوصلك بفريقنا. سيردون عليك قريباً!",
        messageType: "handoff",
        newState: currentState,
        needsHuman: true,
        interventionReason: args.reason || "Customer requested human assistance",
      };
    }

    if (functionName === "check_availability") {
      // Return mock availability for now
      const service = context.services?.find((s: any) => 
        s.name.toLowerCase().includes(args.service_name?.toLowerCase() || "")
      );
      
      const slots = [
        "Tomorrow 10:00 AM",
        "Tomorrow 2:00 PM", 
        "Wednesday 11:00 AM"
      ];

      return {
        reply: `Great choice! Here are available slots for ${service?.name || args.service_name}:\n\n1️⃣ ${slots[0]}\n2️⃣ ${slots[1]}\n3️⃣ ${slots[2]}\n\nWhich one works for you?`,
        messageType: "booking_offer",
        metadata: { slots, service: service?.name },
        newState: { ...currentState, step: "select_slot", service: service?.name },
      };
    }
  }

  return {
    reply: "I understand. How can I help you further?",
    messageType: "text",
    newState: currentState,
  };
}

async function sendWhatsAppMessage(token: string, phoneNumberId: string, to: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp send error:", error);
    }
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
  }
}

function getDefaultReply(language: "en" | "ar") {
  return language === "ar"
    ? "عذراً، لم أفهم طلبك. هل يمكنك إعادة صياغته؟"
    : "I'm sorry, I didn't understand your request. Could you please rephrase?";
}
