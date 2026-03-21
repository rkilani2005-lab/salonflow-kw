import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check available time slots for a staff member or any staff on a given date",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          staff_id: { type: "string", description: "Staff UUID (optional - if omitted checks all staff)" },
          service_duration: { type: "number", description: "Service duration in minutes" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Create a new client in the system",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client full name" },
          phone: { type: "string", description: "Client phone number" },
          email: { type: "string", description: "Client email (optional)" },
          notes: { type: "string", description: "Any notes about the client (optional)" },
        },
        required: ["name", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description: "Create a new appointment/booking",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Client full name" },
          client_phone: { type: "string", description: "Client phone number" },
          client_id: { type: "string", description: "Existing client UUID (optional)" },
          service_id: { type: "string", description: "Service UUID" },
          service_name: { type: "string", description: "Service name" },
          staff_id: { type: "string", description: "Staff UUID" },
          booking_date: { type: "string", description: "Date in YYYY-MM-DD format" },
          start_time: { type: "string", description: "Start time in HH:MM format (24h)" },
          duration: { type: "number", description: "Duration in minutes" },
          price: { type: "number", description: "Service price" },
          notes: { type: "string", description: "Optional notes" },
        },
        required: ["client_name", "client_phone", "service_name", "booking_date", "start_time", "duration"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Search for existing clients by name or phone",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name or phone to search for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staff_list",
      description: "Get the list of active staff members",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_services_list",
      description: "Get the list of available services",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel an existing booking",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string", description: "Booking UUID to cancel" },
          reason: { type: "string", description: "Reason for cancellation (optional)" },
        },
        required: ["booking_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bookings_for_date",
      description: "Get all bookings for a specific date",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["date"],
      },
    },
  },
];

// Execute a tool call and return the result
async function executeTool(
  toolName: string,
  args: Record<string, any>,
  supabase: any,
  tenantId: string
): Promise<string> {
  try {
    switch (toolName) {
      case "check_availability": {
        const { date, staff_id, service_duration = 60 } = args;

        // Get all bookings for that day
        let query = supabase
          .from("bookings")
          .select("start_time,end_time,staff_id,staff:staff_id(name)")
          .eq("booking_date", date)
          .in("status", ["planned", "confirmed", "in_service"]);

        if (staff_id) query = query.eq("staff_id", staff_id);

        const { data: bookings } = await query;

        // Get active staff
        let staffQuery = supabase.from("staff").select("id,name,working_hours_start,working_hours_end").eq("is_active", true);
        if (tenantId) staffQuery = staffQuery.eq("tenant_id", tenantId);
        const { data: staff } = await staffQuery;

        // Build availability slots per staff
        const result: any[] = [];
        for (const s of (staff || [])) {
          if (staff_id && s.id !== staff_id) continue;
          const staffBookings = (bookings || []).filter((b: any) => b.staff_id === s.id);
          const slots: string[] = [];

          // Generate slots from working hours
          const startH = parseInt(s.working_hours_start?.split(":")[0] || "9");
          const endH = parseInt(s.working_hours_end?.split(":")[0] || "18");

          for (let h = startH; h < endH; h++) {
            for (const m of [0, 30]) {
              const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              const slotEndMin = h * 60 + m + service_duration;
              const slotEndH = Math.floor(slotEndMin / 60);
              const slotEndM = slotEndMin % 60;
              const slotEnd = `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`;

              if (slotEndH > endH) continue;

              const conflict = staffBookings.some((b: any) => {
                const bStart = b.start_time?.slice(0, 5);
                const bEnd = b.end_time?.slice(0, 5);
                return slotStart < bEnd && slotEnd > bStart;
              });

              if (!conflict) slots.push(slotStart);
            }
          }

          result.push({ staff_id: s.id, staff_name: s.name, available_slots: slots.slice(0, 10) });
        }

        return JSON.stringify({ date, availability: result });
      }

      case "create_client": {
        const { name, phone, email, notes } = args;
        const { data, error } = await supabase
          .from("clients")
          .insert({ name, phone, email: email || null, notes: notes || null, tenant_id: tenantId, tier: "normal" })
          .select()
          .single();

        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, client: { id: data.id, name: data.name, phone: data.phone } });
      }

      case "create_booking": {
        const {
          client_name, client_phone, client_id,
          service_id, service_name, staff_id,
          booking_date, start_time, duration, price = 0,
          notes, service_category = "other",
        } = args;

        // Calculate end time
        const [sh, sm] = start_time.split(":").map(Number);
        const endMin = sh * 60 + sm + duration;
        const end_time = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

        // Try to find service price if not provided
        let finalPrice = price;
        let finalServiceId = service_id;
        if (!finalServiceId && service_name) {
          const { data: svc } = await supabase
            .from("services")
            .select("id,price")
            .ilike("name", `%${service_name}%`)
            .eq("tenant_id", tenantId)
            .single();
          if (svc) {
            finalServiceId = svc.id;
            finalPrice = svc.price || price;
          }
        }

        const booking = {
          client_name,
          client_phone,
          client_id: client_id || null,
          service_id: finalServiceId || null,
          service_name,
          service_category: service_category || "other",
          staff_id: staff_id || null,
          booking_date,
          start_time,
          end_time,
          duration,
          price: finalPrice,
          status: "planned",
          notes: notes || null,
          is_online_booking: false,
        };

        const { data, error } = await supabase.from("bookings").insert(booking).select().single();
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({
          success: true,
          booking: {
            id: data.id,
            client_name: data.client_name,
            service_name: data.service_name,
            booking_date: data.booking_date,
            start_time: data.start_time,
            end_time: data.end_time,
          },
        });
      }

      case "search_clients": {
        const { query } = args;
        const { data } = await supabase
          .from("clients")
          .select("id,name,phone,email,tier")
          .eq("tenant_id", tenantId)
          .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(5);
        return JSON.stringify({ clients: data || [] });
      }

      case "get_staff_list": {
        const { data } = await supabase
          .from("staff")
          .select("id,name,working_hours_start,working_hours_end")
          .eq("is_active", true)
          .eq("tenant_id", tenantId);
        return JSON.stringify({ staff: data || [] });
      }

      case "get_services_list": {
        const { data } = await supabase
          .from("services")
          .select("id,name,duration,price,category")
          .eq("is_active", true)
          .eq("tenant_id", tenantId);
        return JSON.stringify({ services: data || [] });
      }

      case "cancel_booking": {
        const { booking_id, reason } = args;
        const { error } = await supabase
          .from("bookings")
          .update({ status: "cancelled", notes: reason || "Cancelled by AI agent" })
          .eq("id", booking_id);
        if (error) return JSON.stringify({ success: false, error: error.message });
        return JSON.stringify({ success: true, message: "Booking cancelled successfully" });
      }

      case "get_bookings_for_date": {
        const { date } = args;
        const { data } = await supabase
          .from("bookings")
          .select("id,client_name,service_name,start_time,end_time,status,staff:staff_id(name)")
          .eq("booking_date", date)
          .order("start_time");
        return JSON.stringify({ bookings: data || [], date });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Tool execution failed" });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { system, messages, tenantId, maxTokens = 2048 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Agentic loop: keep calling AI until it stops using tools
    const conversationMessages = [
      { role: "system", content: system },
      ...messages,
    ];

    let finalText = "";
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: maxTokens,
          messages: conversationMessages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: (err as any)?.error?.message || `HTTP ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const choice = data?.choices?.[0];
      const message = choice?.message;

      if (!message) break;

      // If the model returned tool calls, execute them
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message with tool calls to conversation
        conversationMessages.push({ role: "assistant", content: message.content || "", tool_calls: message.tool_calls });

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          const toolResult = await executeTool(toolName, toolArgs, supabase, tenantId);

          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        // Continue loop to get the final response
        continue;
      }

      // No tool calls — this is the final text response
      finalText = message.content || "";
      break;
    }

    if (!finalText) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: finalText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
