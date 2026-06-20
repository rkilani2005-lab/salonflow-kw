import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface BookingRequest {
  action: 'get-services' | 'get-staff' | 'get-availability' | 'lookup-client' | 'create-booking' | 'get-portal' | 'resolve-slug' | 'request-portal-link';
  tenantId: string;
  serviceId?: string;
  staffId?: string | null;
  bookingDate?: string;
  startTime?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  portalToken?: string;
  slug?: string;
}

/** Build every plausible phone format for DB matching */
function phoneVariants(raw: string): string[] {
  const stripped = raw.replace(/\s/g, '');
  const digits   = stripped.replace(/[^\d]/g, '');
  const variants = new Set<string>([stripped]);
  variants.add(`+${stripped.replace(/^\+/, '')}`);
  if (digits.length === 8)  { variants.add(`+965${digits}`); variants.add(digits); }
  if (digits.length === 11 && digits.startsWith('965')) {
    variants.add(`+${digits}`); variants.add(digits); variants.add(digits.slice(3));
  }
  if (digits.length === 12 && digits.startsWith('0965')) {
    variants.add(`+${digits.slice(1)}`); variants.add(digits.slice(4));
  }
  if (digits.length > 8) variants.add(digits.slice(-8));
  return [...variants].filter(v => v.length >= 8);
}

/** Normalise to +965XXXXXXXX */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 8)  return `+965${digits}`;
  if (digits.length === 11 && digits.startsWith('965')) return `+${digits}`;
  return raw.replace(/\s/g, '');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json() as BookingRequest;

    // ── resolve-slug ──────────────────────────────────────────
    // Maps a public booking slug → tenant_id. Runs before tenant validation
    // because the caller doesn't have a tenantId yet (that's what it's resolving).
    if (body.action === 'resolve-slug') {
      const slug = (body.slug || '').trim().toLowerCase();
      if (!slug) return json({ error: 'Slug required' }, 400);

      const { data: cfg } = await supabase
        .from('booking_config')
        .select('tenant_id')
        .eq('slug', slug)
        .maybeSingle();

      if (!cfg?.tenant_id) return json({ found: false }, 404);

      // Confirm the tenant is active before handing back the id
      const { data: t } = await supabase
        .from('tenants')
        .select('id, is_active')
        .eq('id', cfg.tenant_id)
        .maybeSingle();

      if (!t?.is_active) return json({ found: false }, 404);
      return json({ found: true, tenantId: t.id });
    }

    if (!body.tenantId || !/^[0-9a-f-]{36}$/i.test(body.tenantId)) {
      return json({ error: 'Invalid tenant ID' }, 400);
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, is_active, currency, logo_url')
      .eq('id', body.tenantId)
      .single();

    if (!tenant?.is_active) return json({ error: 'Tenant not found' }, 404);

    // ── get-services ──────────────────────────────────────────
    if (body.action === 'get-services') {
      const { data: services } = await supabase
        .from('services')
        .select('id, name, name_ar, category, duration, price, deposit_required, deposit_amount, color')
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .order('category');

      const { data: bConfig } = await supabase
        .from('booking_config')
        .select('header_title,header_title_ar,welcome_msg,welcome_msg_ar,show_prices,show_staff,advance_booking_days,min_notice_hours,primary_color')
        .eq('tenant_id', body.tenantId)
        .maybeSingle();

      return json({ services: services || [], tenant, bookingConfig: bConfig });
    }

    // ── get-staff ─────────────────────────────────────────────
    if (body.action === 'get-staff') {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, name, name_ar, color, working_hours_start, working_hours_end')
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .order('name');
      return json({ staff: staff || [] });
    }

    // ── get-availability ──────────────────────────────────────
    // Returns booked time ranges for a staff member on a given date
    // so the booking page can grey out unavailable slots
    if (body.action === 'get-availability') {
      const { staffId, bookingDate, tenantId: tid } = body;
      if (!staffId || !bookingDate || !tid) return json({ bookedSlots: [] });

      const { data: existing } = await supabase
        .from('bookings')
        .select('start_time, end_time, duration')
        .eq('staff_id', staffId)
        .eq('booking_date', bookingDate)
        .in('status', ['planned', 'confirmed', 'checked_in', 'in_service']);

      // Return all booked ranges so the UI can block overlapping slots
      return json({ bookedSlots: existing || [] });
    }

    // ── lookup-client ─────────────────────────────────────────
    if (body.action === 'lookup-client') {
      const rawPhone = body.clientPhone?.trim() || '';
      if (!rawPhone) return json({ found: false });

      const variants = phoneVariants(rawPhone);
      const phoneStripped = rawPhone.replace(/\s/g, '');
      const digits = phoneStripped.replace(/[^\d]/g, '');

      console.log(`[lookup] "${rawPhone}" → ${variants.length} variants: ${variants.join(', ')}`);

      let client: any = null;

      // 0. Canonical match on phone_norm (digits only) — same key as the unique index.
      if (digits.length >= 7) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, tier, created_at, tenant_id')
          .eq('tenant_id', body.tenantId)
          .eq('phone_norm', digits)
          .maybeSingle();
        if (error) { console.error(`[lookup] phone_norm query error:`, error.message); }
        if (data) { client = data; console.log(`[lookup] matched (phone_norm): "${digits}"`); }
      }

      // 1. Exact match WITH tenant_id
      if (!client)
      for (const v of variants) {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, tier, created_at, tenant_id')
          .eq('tenant_id', body.tenantId)
          .eq('phone', v)
          .maybeSingle();
        if (error) { console.error(`[lookup] query error for "${v}":`, error.message); }
        if (data) { client = data; console.log(`[lookup] matched (tenant+phone): "${v}"`); break; }
      }

      // 2. Phone-only match (catches clients with NULL tenant_id created before RLS)
      if (!client) {
        for (const v of variants) {
          const { data, error } = await supabase
            .from('clients')
            .select('id, name, email, tier, created_at, tenant_id')
            .eq('phone', v)
            .is('tenant_id', null)
            .maybeSingle();
          if (error) { console.error(`[lookup] null-tenant query error for "${v}":`, error.message); }
          if (data) {
            client = data;
            console.log(`[lookup] matched (phone only, null tenant): "${v}" → backfilling tenant_id`);
            // Backfill tenant_id now that we know which tenant this client belongs to
            await supabase.from('clients').update({ tenant_id: body.tenantId }).eq('id', data.id);
            break;
          }
        }
      }

      // 3. LIKE fallback on last 8 digits (any tenant match first, then null)
      if (!client && digits.length >= 8) {
        const last8 = digits.slice(-8);
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, tier, created_at, tenant_id')
          .eq('tenant_id', body.tenantId)
          .like('phone', `%${last8}`)
          .maybeSingle();
        if (error) { console.error(`[lookup] LIKE query error:`, error.message); }
        if (data) { client = data; console.log(`[lookup] LIKE match: %${last8}`); }
      }

      if (!client) {
        console.log(`[lookup] no match for "${rawPhone}"`);
        return json({ found: false });
      }

      // ── PRIVACY ──────────────────────────────────────────────
      // This is a PUBLIC, unauthenticated endpoint keyed on a guessable value
      // (phone number). Returning full name, email, spend or history would let
      // anyone enumerate a salon's client list. We expose only the minimum needed
      // to make booking feel personal: the FIRST name to greet, and a count of
      // active packages so a returning client knows they can use one. Email,
      // total spend, visit history and loyalty balance stay behind the
      // authenticated client portal (get-portal, which requires a token).
      const firstName = (client.name || '').trim().split(/\s+/)[0] || '';

      const { count: activePackageCount } = await supabase
        .from('client_packages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('status', 'active')
        .gt('sessions_remaining', 0);

      return json({
        found: true,
        client: {
          id: client.id,
          firstName,
          // full name kept server-known but NOT returned; the booking insert
          // uses the name the client re-enters/confirms on the form.
          phone: phoneStripped,
          tier: client.tier,
          activePackageCount: activePackageCount || 0,
        },
      });
    }

    // ── get-portal ────────────────────────────────────────────
    if (body.action === 'get-portal') {
      const token = body.portalToken;
      if (!token) return json({ error: 'Token required' }, 400);

      const { data: tokenRow } = await supabase
        .from('client_portal_tokens')
        .select('client_id, tenant_id, expires_at')
        .eq('token', token)
        .eq('tenant_id', body.tenantId)
        .maybeSingle();

      if (!tokenRow) return json({ error: 'Invalid token' }, 404);
      if (new Date(tokenRow.expires_at) < new Date()) return json({ error: 'Token expired' }, 410);

      const { data: client } = await supabase
        .from('clients')
        .select('id, name, email, phone, tier, created_at')
        .eq('id', tokenRow.client_id)
        .maybeSingle();
      if (!client) return json({ error: 'Client not found' }, 404);

      const today = new Date().toISOString().split('T')[0];

      const { data: upcoming } = await supabase
        .from('bookings')
        .select('id, service_name, booking_date, start_time, end_time, status, price, staff_id')
        .eq('client_id', client.id)
        .gte('booking_date', today)
        .in('status', ['confirmed', 'planned', 'in_service', 'checked_in'])
        .order('booking_date')
        .limit(5);

      const { data: history } = await supabase
        .from('bookings')
        .select('id, service_name, booking_date, start_time, status, price')
        .eq('client_id', client.id)
        .eq('status', 'completed')
        .order('booking_date', { ascending: false })
        .limit(10);

      const { data: packages } = await supabase
        .from('client_packages')
        .select('id, sessions_total, sessions_used, sessions_remaining, expires_at, status, package:package_id(name, color)')
        .eq('client_id', client.id)
        .in('status', ['active'])
        .order('created_at', { ascending: false });

      const { data: loyaltyLog } = await supabase
        .from('loyalty_transactions')
        .select('type, points, balance_after, note, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // clients has no loyalty_points column — balance lives in loyalty_transactions.
      const loyaltyPoints = loyaltyLog?.[0]?.balance_after ?? 0;

      return json({
        client: { ...client, loyaltyPoints },
        upcoming: upcoming || [],
        history: history || [],
        packages: packages || [],
        loyaltyLog: loyaltyLog || [],
        tenant,
      });
    }

    // ── request-portal-link ───────────────────────────────────
    // Customer lost their portal link → send a fresh one to their WhatsApp.
    // Always returns the same generic response so it can't be used to probe
    // which phone numbers are registered clients.
    if (body.action === 'request-portal-link') {
      const rawPhone = body.clientPhone?.trim() || '';
      const digits = rawPhone.replace(/[^\d]/g, '');
      const generic = { ok: true, message: 'If your number is registered, you will receive a link on WhatsApp shortly.' };
      if (digits.length < 7) return json(generic);

      // Find the client by canonical phone within this tenant.
      const { data: client } = await supabase
        .from('clients')
        .select('id, phone')
        .eq('tenant_id', body.tenantId)
        .eq('phone_norm', digits)
        .maybeSingle();

      if (!client) return json(generic);   // don't reveal non-existence

      // Fresh token
      const { data: tokenRow } = await supabase
        .from('client_portal_tokens')
        .insert({ client_id: client.id, tenant_id: body.tenantId })
        .select('token')
        .single();

      if (tokenRow?.token) {
        const origin = req.headers.get('origin') || 'https://app.zaina.ai';
        const link = `${origin}/my?tenant=${body.tenantId}&token=${tokenRow.token}`;
        const msg = `${tenant.name}\n\nHere's your private link to view your appointments, points and packages:\n${link}`;

        // Send through the same Baileys path the AI agent uses. We need an existing
        // WhatsApp conversation for this client (anyone who booked via WhatsApp has one).
        // If none exists we silently skip — Baileys can't cold-initiate reliably.
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('tenant_id', body.tenantId)
          .eq('channel', 'whatsapp')
          .eq('client_id', client.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (conv?.id) {
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
          const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          // fire-and-forget; failure must not reveal anything to the caller
          fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SRK}` },
            body: JSON.stringify({ conversation_id: conv.id, text: msg, sender_type: 'system' }),
          }).catch((e) => console.warn('[request-portal-link] channel-send failed:', e?.message));
        } else {
          console.log('[request-portal-link] no WhatsApp conversation for client; skipping send');
        }
      }

      return json(generic);
    }

    // ── create-booking ────────────────────────────────────────
    if (body.action === 'create-booking') {
      const { serviceId, staffId, bookingDate, startTime, clientName, clientPhone, clientEmail } = body;

      // Input validation
      if (!serviceId || !/^[0-9a-f-]{36}$/i.test(serviceId)) return json({ error: 'Invalid service' }, 400);
      if (staffId && !/^[0-9a-f-]{36}$/i.test(staffId))       return json({ error: 'Invalid staff' }, 400);
      if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return json({ error: 'Invalid date' }, 400);
      if (!startTime   || !/^\d{2}:\d{2}$/.test(startTime))  return json({ error: 'Invalid time' }, 400);
      if (!clientName  || clientName.trim().length < 2)       return json({ error: 'Name too short' }, 400);
      if (!clientPhone)                                        return json({ error: 'Phone required' }, 400);

      const today = new Date().toISOString().split('T')[0];
      if (bookingDate < today) return json({ error: 'Cannot book in the past' }, 400);

      // Fetch & validate service
      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .single();
      if (svcErr || !service) {
        console.error('[create-booking] service not found:', svcErr);
        return json({ error: 'Service not found' }, 404);
      }

      // Validate staff
      if (staffId) {
        const { data: sm } = await supabase
          .from('staff')
          .select('id')
          .eq('id', staffId)
          .eq('tenant_id', body.tenantId)
          .eq('is_active', true)
          .single();
        if (!sm) return json({ error: 'Staff not found' }, 404);
      }

      // Normalise phone
      const sanitizedName  = clientName.trim();
      const phoneStripped  = clientPhone.replace(/\s/g, '');
      const normalizedPhone = normalisePhone(phoneStripped);
      const variants = phoneVariants(phoneStripped);

      // Calculate end time
      const [h, m] = startTime.split(':').map(Number);
      const endMin  = h * 60 + m + service.duration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      // ── Find or create client ──
      // The DB enforces UNIQUE (tenant_id, phone_norm) where phone_norm is the
      // digits-only form of phone. We MUST match on the same canonical value or
      // the insert will collide with an existing row → "Failed to create client".
      const phoneDigits = phoneStripped.replace(/[^\d]/g, '');
      let existingClientId: string | null = null;

      // 0. Canonical match on phone_norm (digits only) within this tenant — the
      //    exact key the unique index uses, so this catches every real duplicate.
      if (phoneDigits.length >= 7) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('tenant_id', body.tenantId)
          .eq('phone_norm', phoneDigits)
          .maybeSingle();
        if (data) existingClientId = data.id;
      }

      // 1. Exact match with tenant_id (formatting variants)
      if (!existingClientId) {
        for (const v of variants) {
          const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', v)
            .eq('tenant_id', body.tenantId)
            .maybeSingle();
          if (data) { existingClientId = data.id; break; }
        }
      }

      // 2. Match clients with NULL tenant_id (legacy records)
      if (!existingClientId) {
        for (const v of variants) {
          const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', v)
            .is('tenant_id', null)
            .maybeSingle();
          if (data) {
            existingClientId = data.id;
            // Backfill tenant_id
            await supabase.from('clients').update({ tenant_id: body.tenantId }).eq('id', data.id);
            break;
          }
        }
      }

      // 3. LIKE fallback
      if (!existingClientId) {
        if (phoneDigits.length >= 8) {
          const { data } = await supabase
            .from('clients')
            .select('id')
            .eq('tenant_id', body.tenantId)
            .like('phone', `%${phoneDigits.slice(-8)}`)
            .maybeSingle();
          if (data) existingClientId = data.id;
        }
      }

      let clientId: string;
      let isNewClient = false;

      if (existingClientId) {
        clientId = existingClientId;
        // Update email if missing
        if (clientEmail) {
          await supabase.from('clients')
            .update({ email: clientEmail })
            .eq('id', clientId)
            .is('email', null);
        }
        // Also ensure tenant_id is set (backfill for legacy records)
        await supabase.from('clients')
          .update({ tenant_id: body.tenantId })
          .eq('id', clientId)
          .is('tenant_id', null);
      } else {
        const { data: newClient, error: ce } = await supabase
          .from('clients')
          .insert({
            name:      sanitizedName,
            phone:     normalizedPhone,
            email:     clientEmail || null,
            tenant_id: body.tenantId,
          })
          .select('id')
          .single();
        if (ce || !newClient) {
          // 23505 = unique_violation. A client with this phone_norm already exists
          // but slipped past the lookups (e.g. different stored format). Recover by
          // fetching that row instead of failing the whole booking.
          if (ce && (ce.code === '23505' || /duplicate key|unique/i.test(ce.message))) {
            const { data: dup } = await supabase
              .from('clients')
              .select('id')
              .eq('tenant_id', body.tenantId)
              .eq('phone_norm', phoneDigits)
              .maybeSingle();
            if (dup) {
              clientId = dup.id;
            } else {
              console.error('[create-booking] client insert conflict but no row found:', ce);
              return json({ error: 'Could not match your details. Please call the salon.' }, 500);
            }
          } else {
            console.error('[create-booking] client insert error:', ce);
            return json({ error: 'Failed to create client' }, 500);
          }
        } else {
          clientId = newClient.id;
          isNewClient = true;
        }
      }

      // ── Conflict check: prevent double-booking a stylist ─────
      if (staffId) {
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('id, start_time, end_time')
          .eq('staff_id', staffId)
          .eq('booking_date', bookingDate)
          .in('status', ['planned', 'confirmed', 'checked_in', 'in_service'])
          .lt('start_time', endTime)   // existing booking starts before our end
          .gt('end_time',  startTime); // existing booking ends after our start

        if (conflicts && conflicts.length > 0) {
          return json({
            error: 'This stylist is not available at the selected time. Please choose a different time or stylist.',
          }, 409);
        }
      }

      // Insert booking — status: 'planned' (awaits admin confirmation)
      const { data: booking, error: be } = await supabase.from('bookings').insert({
        tenant_id:         body.tenantId,
        client_id:         clientId,
        client_name:       sanitizedName,
        client_phone:      normalizedPhone,
        staff_id:          staffId || null,
        service_id:        service.id,
        service_name:      service.name,
        service_category:  service.category,
        booking_date:      bookingDate,
        start_time:        startTime,
        end_time:          endTime,
        duration:          service.duration,
        price:             service.price,
        deposit_amount:    service.deposit_amount,
        is_online_booking: true,
        status:            'planned',
        notes:             '⏳ Online booking — awaiting confirmation',
      }).select().single();

      if (be || !booking) {
        console.error('[create-booking] booking insert error:', be);
        return json({ error: `Failed to create booking: ${be?.message || 'unknown'}` }, 500);
      }

      console.log(`[create-booking] ✅ booking ${booking.id} for client ${clientId} (${isNewClient ? 'new' : 'returning'})`);

      // Log to admin inbox (non-blocking)
      supabase.from('online_booking_requests').insert({
        booking_id:   booking.id,
        tenant_id:    body.tenantId,
        client_name:  sanitizedName,
        client_phone: normalizedPhone,
        service_name: service.name,
        booking_date: bookingDate,
        start_time:   startTime,
        status:       'pending',
      }).then(({ error: reqErr }) => {
        if (reqErr) console.warn('[create-booking] request log failed:', reqErr.message);
      });

      // Generate portal token
      const { data: tokenRow } = await supabase
        .from('client_portal_tokens')
        .insert({ client_id: clientId, tenant_id: body.tenantId })
        .select('token')
        .single();

      // Deposit via MyFatoorah
      if (service.deposit_required && service.deposit_amount > 0) {
        const MF_KEY = Deno.env.get('MYFATOORAH_API_KEY');
        const MF_API = Deno.env.get('MYFATOORAH_API_URL') || 'https://apitest.myfatoorah.com';
        if (MF_KEY) {
          const origin = req.headers.get('origin') || 'https://app.lovable.dev';
          try {
            const mobileNum = normalizedPhone.replace('+965', '').replace(/\s/g, '');
            const pr = await fetch(`${MF_API}/v2/ExecutePayment`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${MF_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                PaymentMethodId: 0,
                CustomerName:    sanitizedName,
                DisplayCurrencyIso: 'KWD',
                MobileCountryCode: '+965',
                CustomerMobile:  mobileNum,
                CustomerEmail:   clientEmail || '',
                InvoiceValue:    service.deposit_amount,
                Language:        'EN',
                CallBackUrl: `${origin}/booking/success?booking=${booking.id}&token=${tokenRow?.token || ''}`,
                ErrorUrl:    `${origin}/booking/failed?booking=${booking.id}`,
                CustomerReference: booking.id,
                InvoiceItems: [{
                  ItemName:  `Deposit: ${service.name}`,
                  Quantity:  1,
                  UnitPrice: service.deposit_amount,
                }],
              }),
            }).then(r => r.json());

            if (pr.IsSuccess) {
              await supabase.from('bookings').update({
                payment_id:     pr.Data.InvoiceId.toString(),
                payment_url:    pr.Data.PaymentURL,
                deposit_status: 'pending',
              }).eq('id', booking.id);

              supabase.from('payment_transactions').insert({
                booking_id:       booking.id,
                payment_provider: 'myfatoorah',
                invoice_id:       pr.Data.InvoiceId.toString(),
                amount:           service.deposit_amount,
                currency:         'KWD',
                status:           'pending',
                raw_response:     pr,
              });

              return json({
                success:         true,
                bookingId:       booking.id,
                booking:         booking,
                requiresPayment: true,
                paymentUrl:      pr.Data.PaymentURL,
                portalToken:     tokenRow?.token,
                isNewClient,
              });
            }
          } catch (mfErr) {
            console.error('[create-booking] MyFatoorah error (non-fatal):', mfErr);
          }
        }
      }

      return json({
        success:         true,
        bookingId:       booking.id,   // primary field
        booking:         booking,       // full object (backward compat)
        requiresPayment: false,
        isNewClient,
        portalToken:     tokenRow?.token || null,
      });
    }

    return json({ error: 'Invalid action' }, 400);

  } catch (err) {
    console.error('[create-public-booking] unhandled error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
