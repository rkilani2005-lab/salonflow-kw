// Customer self-check-in — public, no auth. Customer scans QR / taps WhatsApp link,
// lands on /checkin/:token, frontend POSTs here. Flips booking status to 'checked_in'
// if window conditions met.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ ok: false, error: "token required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: booking, error } = await admin
      .from("bookings")
      .select("id, status, start_time, tenant_id, client_id, checked_in_at, services:service_id(name, name_ar)")
      .eq("check_in_token", token)
      .maybeSingle();

    if (error || !booking) return json({ ok: false, error: "not_found" }, 404);

    if (booking.checked_in_at) {
      return json({
        ok: true, already: true,
        booking_id: booking.id, status: booking.status,
        service: booking.services,
        message: "You are already checked in. Please take a seat.",
      });
    }

    if (!["planned", "confirmed"].includes(booking.status)) {
      return json({
        ok: false, error: "not_checkinable",
        message: `This booking is ${booking.status} and cannot be checked in.`,
      });
    }

    const start = new Date(booking.start_time).getTime();
    const now = Date.now();
    if (now < start - 30 * 60 * 1000) {
      return json({ ok: false, error: "too_early",
        message: "It's too early to check in. Please come back closer to your appointment time." });
    }
    if (now > start + 60 * 60 * 1000) {
      return json({ ok: false, error: "too_late",
        message: "Your booking window has expired. Please speak with reception." });
    }

    await admin.from("bookings")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", booking.id);

    return json({ ok: true, booking_id: booking.id, service: booking.services,
      message: "You're checked in! A staff member will be with you shortly." });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
