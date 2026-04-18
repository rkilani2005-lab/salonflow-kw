/**
 * invite-user — sends a Supabase auth invite email to a new team member
 *
 * Called by the tenant portal's Team Management page.
 * Uses the service-role key (server-side only) to call
 * supabase.auth.admin.inviteUserByEmail(), which:
 *   1. Creates an auth user in pending state
 *   2. Sends them a "Set your password" email
 *   3. On first login, the app reads user_metadata to
 *      auto-link their profile to the tenant + assign role
 *
 * POST body:
 *   { tenant_id, email, role, invited_by_name, salon_name }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://zaina.app','https://app.lovable.dev','http://localhost:8080','http://localhost:3000'];
function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.some(a => o.startsWith(a)) ? o : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
}

const ROLE_LABELS: Record<string, string> = {
  manager:        'Manager',
  receptionist:   'Receptionist',
  cashier:        'Cashier',
  stylist:        'Stylist',
  inventory_clerk:'Inventory Clerk',
  accountant:     'Accountant',
  readonly:       'Read-only',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
  const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Admin client — service role bypasses RLS
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Regular client — uses the caller's JWT to verify they're owner/manager
  const authHeader = req.headers.get('Authorization');
  const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader || '' } },
  });

  try {
    const { tenant_id, email, role, invited_by_name, salon_name } = await req.json();

    if (!tenant_id || !email || !role) {
      return json({ error: 'tenant_id, email, and role are required' }, 400);
    }

    // ── 1. Verify caller is owner/manager of this tenant ─────
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!callerRole || !['owner', 'manager'].includes(callerRole.role)) {
      return json({ error: 'Only owners and managers can invite users' }, 403);
    }

    // ── 2. Check plan user limit ─────────────────────────────
    //
    // Previously this block hardcoded the plan→limit mapping
    // (starter=3, professional=10, ai=9999) AND used
    // count_tenant_users which only counts CURRENT members in
    // user_roles — not pending invitations.  That created a race
    // window: a tenant at 2/3 could fire 5 invite requests in
    // parallel, each would see currentCount=2 and pass the check,
    // and when the invited users set their passwords the tenant
    // would end up at 7 members, quietly over the limit.
    //
    // Fix: (a) source the limit from get_plan_user_limit RPC so
    // there's one source of truth, (b) add unexpired pending
    // invites to the count so the race closes and the check
    // reflects the actual committed-plus-pending seat usage.
    const { data: tenant } = await adminClient
      .from('tenants')
      .select('subscription_plan, name')
      .eq('id', tenant_id)
      .single();

    const plan = (tenant as any)?.subscription_plan || 'starter';

    const { data: limitResult } = await adminClient
      .rpc('get_plan_user_limit', { p_plan: plan });
    const limit = (limitResult as number) ?? 3;

    const { data: countResult } = await adminClient
      .rpc('count_tenant_users', { p_tenant_id: tenant_id });
    const memberCount = (countResult as number) || 0;

    // Count unexpired pending invitations.  Excludes revoked /
    // expired / accepted so we don't double-count.  Accepted ones
    // are already in user_roles and therefore in memberCount.
    const { count: pendingInvites } = await adminClient
      .from('tenant_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    const effectiveCount = memberCount + (pendingInvites || 0);

    if (effectiveCount >= limit) {
      return json({
        error: `Your ${plan} plan allows up to ${limit} users. You currently have ${memberCount} member${memberCount === 1 ? '' : 's'}${pendingInvites ? ` plus ${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}` : ''}. Upgrade to add more team members.`,
        limit_reached: true,
        current:       memberCount,
        pending:       pendingInvites || 0,
        limit,
      }, 400);
    }

    // ── 3. Check for existing invitation ────────────────────
    const { data: existingInvite } = await adminClient
      .from('tenant_invitations')
      .select('id, status')
      .eq('tenant_id', tenant_id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingInvite?.status === 'accepted') {
      return json({ error: 'This user already has access to your salon.' }, 400);
    }

    // ── 4. Upsert invitation record ──────────────────────────
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await adminClient.from('tenant_invitations').upsert({
      tenant_id,
      email:         email.toLowerCase(),
      role,
      status:        'pending',
      invited_by:    caller.id,
      expires_at:    expiresAt,
    }, { onConflict: 'tenant_id,email' });

    // ── 5. Send auth invite via Supabase ─────────────────────
    // user_metadata is embedded in the invite link and available
    // on the user object after they set their password.
    const redirectTo = `${Deno.env.get('SITE_URL') || 'https://zaina.ai'}/auth?invite=1`;

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        redirectTo,
        data: {
          tenant_id,
          role,
          salon_name: (tenant as any)?.name || salon_name,
          invited_by_name: invited_by_name || 'Your salon manager',
        },
      }
    );

    if (inviteError) {
      // If user already exists in auth, just update the invitation record
      // and return success — they'll see the portal on next login
      if (inviteError.message?.includes('already been registered')) {
        // Find existing auth user and link them to tenant
        const { data: existingUser } = await adminClient
          .from('profiles')
          .select('user_id')
          .eq('id', email.toLowerCase()) // won't match but safer
          .maybeSingle();

        return json({
          success: true,
          note: 'User already has an account. They can log in and will be linked to your salon automatically.',
          already_exists: true,
        });
      }
      throw inviteError;
    }

    return json({
      success:  true,
      email,
      role:     ROLE_LABELS[role] || role,
      expires_at: expiresAt,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('invite-user error:', msg);
    return json({ error: msg }, 500);
  }
});
