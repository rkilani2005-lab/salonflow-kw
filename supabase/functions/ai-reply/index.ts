// supabase/functions/ai-reply/index.ts
// ---------------------------------------------------------------
// D.6 — AI agent for incoming WhatsApp messages.
//
// Triggered fire-and-forget by baileys-inbound after every inbound
// text message lands.  Does its own gating (conversation.ai_handoff
// + channel_accounts.ai_agent_enabled + cooldown) so the caller
// can dispatch unconditionally.
//
// FLOW
//   1. Load message + conversation + tenant context.
//   2. Gate: bail out if AI is disabled, or staff replied recently
//      (cooldown to avoid colliding with a human owner typing on
//      their own phone).
//   3. Build tenant-aware system prompt: salon name, services list,
//      opening hours, today/tomorrow availability.
//   4. Load last 10 messages of conversation history.
//   5. Call Claude with tool definitions for the four supported
//      intents: reply, check_availability, book_appointment,
//      lookup_invoice.
//   6. Execute tools as Claude requests them (multi-turn within
//      this single inbound event, capped at 5 hops).
//   7. Send the final text via channel-send.
//   8. Mark message ai_handled = true (idempotency).
//
// SECURITY
//   This function is INTERNAL — invoked only by baileys-inbound
//   with the service role key.  It never accepts user-typed
//   parameters as authoritative; everything important is re-read
//   from the DB.
// ---------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cooldown window: if staff sent a message in the last N minutes, AI
// stays out of the way.  5 minutes is enough that an owner mid-typing
// won't get spoken-over, short enough that AI resumes if the owner
// puts the phone down.
const STAFF_COOLDOWN_MIN = 5;

// Cap on AI tool-use loop iterations.  Each iteration is one Claude
// call.  In practice 2-3 is normal (gather → reply, or gather →
// confirm → book).  5 is generous for tricky multi-step bookings.
const MAX_AI_HOPS = 5;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ error: "message_id required" }, 400);

    // 1. Load message + conversation + tenant.  Joined select avoids
    //    three round-trips.
    const { data: msg, error: mErr } = await sb
      .from("messages")
      .select(`
        id, tenant_id, conversation_id, content, content_type, direction,
        ai_handled, created_at,
        conversation:conversations!inner (
          id, ai_handoff, external_id, client_id, channel,
          channel_account:channel_accounts!inner ( id, ai_agent_enabled, status )
        )
      `)
      .eq("id", message_id)
      .single();
    if (mErr || !msg) return json({ skip: "message_not_found" });

    if (msg.direction !== "inbound")           return json({ skip: "not_inbound"     });
    if (msg.ai_handled)                        return json({ skip: "already_handled" });
    if (msg.content_type !== "text")           return json({ skip: "not_text"        });
    if (!msg.content || !msg.content.trim())   return json({ skip: "empty_content"   });

    // 2. AI gates.
    const conv = msg.conversation as any;
    const ca   = conv.channel_account as any;
    if (!conv.ai_handoff)            return json({ skip: "ai_disabled_for_thread" });
    if (!ca.ai_agent_enabled)        return json({ skip: "ai_disabled_for_account" });
    if (ca.status !== "connected")   return json({ skip: "channel_disconnected" });

    // 2a. Cooldown: if staff sent something recently, stay quiet.
    const cooldownStart = new Date(Date.now() - STAFF_COOLDOWN_MIN * 60_000).toISOString();
    const { count: staffRecent } = await sb
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("direction", "outbound")
      .eq("sender_type", "staff")
      .gte("created_at", cooldownStart);
    if ((staffRecent ?? 0) > 0) {
      return json({ skip: "staff_active" });
    }

    // 3. Build tenant context for the system prompt.
    const ctx = await loadTenantContext(msg.tenant_id, conv.client_id);

    // 4. Load conversation history (last 10 messages, oldest first).
    const { data: history } = await sb
      .from("messages")
      .select("direction, sender_type, content")
      .eq("conversation_id", conv.id)
      .eq("content_type", "text")
      .order("created_at", { ascending: false })
      .limit(10);
    const claudeHistory: { role: "user" | "assistant"; content: string }[] =
      (history ?? [])
        .reverse()
        .filter((m: any) => m.content)
        .map((m: any) => ({
          role:    m.direction === "inbound" ? "user" : "assistant",
          content: m.content,
        }));

    // 5-6. Run the tool-use loop.
    const finalReply = await runAgent({
      conversation_id: conv.id,
      tenant_id:       msg.tenant_id,
      client_id:       conv.client_id,
      external_id:     conv.external_id,
      systemPrompt:    buildSystemPrompt(ctx),
      history:         claudeHistory,
    });

    // 7. Send the reply.
    console.log("[ai-reply] finalReply length:", finalReply?.length ?? 0, "preview:", (finalReply || "").slice(0, 120));
    if (finalReply && finalReply.trim()) {
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          conversation_id: conv.id,
          text:            finalReply,
          sender_type:     "ai",
        }),
      });
      const sendBody = await sendRes.text();
      console.log("[ai-reply] channel-send status:", sendRes.status, "body:", sendBody.slice(0, 300));
    } else {
      console.warn("[ai-reply] no finalReply produced — skipping channel-send");
    }

    // 8. Idempotency.
    await sb.from("messages").update({ ai_handled: true }).eq("id", msg.id);

    return json({ ok: true, replied: !!finalReply });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[ai-reply] error:", m);
    // Return 200 anyway — caller is fire-and-forget; we don't want
    // baileys-inbound retrying because AI hit a snag.
    return new Response(`logged: ${m}`, { status: 200, headers: cors });
  }
});

// ───────────────────────────────────────────────────────────────
// Tenant context loader
// ───────────────────────────────────────────────────────────────

interface TenantCtx {
  tenant:     { id: string; name: string; currency: string; timezone: string };
  client:     { id: string; name: string; loyalty_points: number } | null;
  services:   { id: string; name: string; price: number; duration: number; category: string }[];
  staff:      { id: string; name: string }[];
  hours:      string; // human-readable summary
}

async function loadTenantContext(tenantId: string, clientId: string | null): Promise<TenantCtx> {
  const [tenantRes, servicesRes, staffRes, clientRes] = await Promise.all([
    sb.from("tenants")
      .select("id, name, currency, timezone").eq("id", tenantId).single(),
    sb.from("services")
      .select("id, name, price, duration, category")
      .eq("tenant_id", tenantId).eq("is_active", true).order("name").limit(50),
    sb.from("staff")
      .select("id, name").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
    clientId
      ? sb.from("clients").select("id, name, loyalty_points").eq("id", clientId).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    tenant:   tenantRes.data ?? { id: tenantId, name: "the salon", currency: "KWD", timezone: "Asia/Kuwait" },
    client:   clientRes.data ?? null,
    services: servicesRes.data ?? [],
    staff:    staffRes.data ?? [],
    // TODO: actual opening hours from tenant_settings.  Placeholder for now —
    // most Kuwait salons run roughly 10am-10pm, which is a fair default.
    hours: "Daily 10:00 to 22:00 (Kuwait time)",
  };
}

function buildSystemPrompt(ctx: TenantCtx): string {
  const servicesList = ctx.services.length
    ? ctx.services
        .map(s => `- ${s.name} (${s.duration} min, ${s.price.toFixed(3)} ${ctx.tenant.currency})`)
        .join("\n")
    : "(no services configured yet)";

  const staffList = ctx.staff.length
    ? ctx.staff.map(s => `- ${s.name}`).join("\n")
    : "(no staff)";

  const clientLine = ctx.client
    ? `The client you are speaking with is ${ctx.client.name} (loyalty points: ${ctx.client.loyalty_points}).`
    : "This person is not yet a registered client.";

  return `You are the WhatsApp assistant for ${ctx.tenant.name}, a salon in Kuwait.

${clientLine}

You can:
- Answer questions about services and prices.
- Check availability for a service on a specific date/time.
- Book an appointment after explicit client confirmation.
- Look up the client's most recent invoice and send a PDF.

You CANNOT:
- Modify prices, give unauthorized discounts, or make promises about loyalty rewards beyond what's stored.
- Cancel or modify existing appointments — escalate those to staff.
- Discuss other clients' information.

When the client's request is ambiguous or sensitive (complaint, refund, anything emotional), keep your reply brief and say a team member will follow up — do NOT try to handle it yourself.

Reply in the same language the client uses (English or Arabic).  Keep messages short and natural — this is WhatsApp, not email.  Use the salon's currency: ${ctx.tenant.currency}.

Services:
${servicesList}

Staff:
${staffList}

Hours: ${ctx.hours}.

When booking, ALWAYS confirm with the client (service, date, time, staff if specified) BEFORE calling book_appointment.  Never book speculatively.`;
}

// ───────────────────────────────────────────────────────────────
// Agent loop
// ───────────────────────────────────────────────────────────────

interface AgentInput {
  conversation_id: string;
  tenant_id:       string;
  client_id:       string | null;
  external_id:     string;
  systemPrompt:    string;
  history:         { role: "user" | "assistant"; content: string }[];
}

const TOOLS = [
  {
    name: "check_availability",
    description: "Check if a service is available on a specific date and approximate time. Returns a list of free slots.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Service name as listed in the system prompt." },
        date:         { type: "string", description: "ISO date YYYY-MM-DD." },
        preferred_time: { type: "string", description: "Optional preferred start time HH:MM 24-hour. Omit for any time of day." },
      },
      required: ["service_name", "date"],
    },
  },
  {
    name: "book_appointment",
    description: "Create a confirmed appointment AFTER the client has explicitly agreed to a specific service, date, and time. Never call without confirmation.",
    input_schema: {
      type: "object",
      properties: {
        service_name:   { type: "string" },
        date:           { type: "string", description: "ISO date YYYY-MM-DD." },
        start_time:     { type: "string", description: "HH:MM 24-hour." },
        staff_name:     { type: "string", description: "Optional preferred staff member by name." },
      },
      required: ["service_name", "date", "start_time"],
    },
  },
  {
    name: "lookup_last_invoice",
    description: "Retrieve the client's most recent paid invoice (transaction). Returns total, items, date.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

async function runAgent(input: AgentInput): Promise<string> {
  const messages: any[] = input.history.slice();
  let finalText = "";

  for (let hop = 0; hop < MAX_AI_HOPS; hop++) {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",  // cheap, fast — fine for this use
        max_tokens: 800,
        system:     input.systemPrompt,
        tools:      TOOLS,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("[ai-reply] Claude HTTP", claudeRes.status, errText);
      // Graceful degrade: a bland holding reply rather than silence.
      return "Thanks for your message — a team member will be with you shortly.";
    }

    const body = await claudeRes.json();

    // Always append the assistant turn so subsequent hops have context.
    messages.push({ role: "assistant", content: body.content });

    // Did Claude stop because it wants tools?
    if (body.stop_reason === "tool_use") {
      const toolCalls = (body.content as any[]).filter(b => b.type === "tool_use");
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        const result = await runTool(tc.name, tc.input, input);
        toolResults.push({
          type:        "tool_result",
          tool_use_id: tc.id,
          content:     JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue;  // next hop — Claude reads results, formulates reply
    }

    // Final answer — collect all text blocks.
    finalText = (body.content as any[])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();
    break;
  }

  return finalText;
}

// ───────────────────────────────────────────────────────────────
// Tool execution
// ───────────────────────────────────────────────────────────────

async function runTool(name: string, args: any, input: AgentInput): Promise<any> {
  try {
    switch (name) {
      case "check_availability":   return await checkAvailability(args, input);
      case "book_appointment":     return await bookAppointment(args, input);
      case "lookup_last_invoice":  return await lookupLastInvoice(input);
      default:                     return { error: `unknown tool ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkAvailability(args: any, input: AgentInput) {
  // Resolve service name → id + duration.
  const { data: svc } = await sb
    .from("services")
    .select("id, name, duration")
    .eq("tenant_id", input.tenant_id)
    .ilike("name", `%${args.service_name}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!svc) return { error: "service_not_found", searched: args.service_name };

  // Read existing bookings on the requested date — anything with a
  // status that occupies the calendar.
  const { data: existing } = await sb
    .from("bookings")
    .select("start_time, end_time, status")
    .eq("tenant_id", input.tenant_id)
    .eq("booking_date", args.date)
    .in("status", ["confirmed", "checked_in", "in_service", "completed"]);

  // Generate candidate slots every 30 minutes within opening hours.
  // (Hours hardcoded — same TODO as buildSystemPrompt.)
  const slots: string[] = [];
  for (let h = 10; h < 22; h++) {
    for (const m of [0, 30]) {
      const startMin = h * 60 + m;
      const endMin   = startMin + svc.duration;
      if (endMin > 22 * 60) continue;
      const conflict = (existing ?? []).some((b: any) => {
        const [bsh, bsm] = b.start_time.split(":").map(Number);
        const [beh, bem] = b.end_time.split(":").map(Number);
        const bs = bsh * 60 + bsm;
        const be = beh * 60 + bem;
        return startMin < be && endMin > bs;
      });
      if (!conflict) {
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
  }

  // If a preferred time was given, return slots near it.
  if (args.preferred_time) {
    const [ph, pm] = args.preferred_time.split(":").map(Number);
    const pref = ph * 60 + pm;
    slots.sort((a, b) => {
      const am = Number(a.slice(0, 2)) * 60 + Number(a.slice(3));
      const bm = Number(b.slice(0, 2)) * 60 + Number(b.slice(3));
      return Math.abs(am - pref) - Math.abs(bm - pref);
    });
  }
  return {
    service: svc.name,
    duration_min: svc.duration,
    date: args.date,
    available_slots: slots.slice(0, 6),
  };
}

async function bookAppointment(args: any, input: AgentInput) {
  if (!input.client_id) {
    return { error: "client_not_registered", hint: "Ask staff to register this client before booking." };
  }
  // Resolve service.
  const { data: svc } = await sb
    .from("services")
    .select("id, name, duration, price, category")
    .eq("tenant_id", input.tenant_id)
    .ilike("name", `%${args.service_name}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!svc) return { error: "service_not_found" };

  // Optionally resolve staff.
  let staffId: string | null = null;
  if (args.staff_name) {
    const { data: st } = await sb
      .from("staff")
      .select("id, name")
      .eq("tenant_id", input.tenant_id)
      .ilike("name", `%${args.staff_name}%`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (st) staffId = st.id;
  }

  // Compute end_time from duration.
  const [h, m] = args.start_time.split(":").map(Number);
  const endMin = h * 60 + m + svc.duration;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  // Last-mile conflict re-check: another tool-use hop might have raced.
  const { count: clash } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenant_id)
    .eq("booking_date", args.date)
    .lt("start_time", endTime)
    .gt("end_time",   args.start_time)
    .in("status", ["confirmed", "checked_in", "in_service"]);
  if ((clash ?? 0) > 0) {
    return { error: "slot_taken", message: "That slot was just booked. Please offer alternative slots." };
  }

  const { data: client } = await sb
    .from("clients").select("name, phone").eq("id", input.client_id).single();

  const { data: booking, error: bErr } = await sb.from("bookings").insert({
    tenant_id:       input.tenant_id,
    client_id:       input.client_id,
    client_name:     client?.name,
    client_phone:    client?.phone,
    staff_id:        staffId,
    service_id:      svc.id,
    service_name:    svc.name,
    service_category: svc.category,
    booking_date:    args.date,
    start_time:      args.start_time,
    end_time:        endTime,
    duration:        svc.duration,
    price:           svc.price,
    status:          "confirmed",
    notes:           "Booked via WhatsApp AI",
    is_online_booking: true,
  }).select("id").single();

  if (bErr) return { error: bErr.message };
  return {
    booked: true,
    booking_id: booking.id,
    service: svc.name,
    date: args.date,
    start_time: args.start_time,
    end_time: endTime,
  };
}

async function lookupLastInvoice(input: AgentInput) {
  if (!input.client_id) return { error: "client_not_registered" };

  const { data: txn } = await sb
    .from("transactions")
    .select(`
      id, created_at, grand_total, status,
      items:transaction_items ( item_name, quantity, total_price )
    `)
    .eq("tenant_id", input.tenant_id)
    .eq("client_id", input.client_id)
    .neq("status", "refunded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!txn) return { found: false };

  // Generate + send PDF in one call.  invoice-pdf handles the
  // upload, signing, and channel-send dispatch.  We don't await
  // the full send — Claude only needs to know we kicked it off
  // so it can write a friendly "I'm sending your invoice now"
  // reply.  The PDF itself arrives separately as an outbound
  // message, which baileys-inbound's dedupe will keep clean.
  let pdfDispatched = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/invoice-pdf`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        transaction_id:  txn.id,
        conversation_id: input.conversation_id,
      }),
    });
    if (res.ok) {
      const body = await res.json();
      pdfDispatched = !!body?.dispatched;
    }
  } catch (e) {
    console.warn("[ai-reply] invoice-pdf dispatch failed:", e);
  }

  return {
    found:           true,
    transaction_id:  txn.id,
    date:            (txn.created_at as string).slice(0, 10),
    total:           txn.grand_total,
    items:           (txn.items as any[]) ?? [],
    pdf_dispatched:  pdfDispatched,
    note: pdfDispatched
      ? "PDF is being sent to the client now as a separate message — confirm receipt in your reply."
      : "Could not send PDF automatically — summarise the invoice in text instead.",
  };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
