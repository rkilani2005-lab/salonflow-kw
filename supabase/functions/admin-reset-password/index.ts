import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const { email, password } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (lErr) throw lErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return new Response(JSON.stringify({ error: "user not found" }), { status: 404 });
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: user.id }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
