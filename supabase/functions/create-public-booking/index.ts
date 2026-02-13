import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  action: 'get-services' | 'get-staff' | 'create-booking';
  tenantId: string;
  // For create-booking
  serviceId?: string;
  staffId?: string | null;
  bookingDate?: string;
  startTime?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as BookingRequest;

    // Validate tenantId
    if (!body.tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.tenantId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing tenant ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant exists and is active
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, is_active')
      .eq('id', body.tenantId)
      .single();

    if (!tenant || !tenant.is_active) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'get-services') {
      const { data: services } = await supabase
        .from('services')
        .select('id, name, name_ar, category, duration, price, deposit_required, deposit_amount, color')
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .order('category');

      return new Response(
        JSON.stringify({ services: services || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'get-staff') {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, name, name_ar, color, working_hours_start, working_hours_end')
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .order('name');

      return new Response(
        JSON.stringify({ staff: staff || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'create-booking') {
      // Validate required fields
      const { serviceId, staffId, bookingDate, startTime, clientName, clientPhone, clientEmail } = body;

      if (!serviceId || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
        return new Response(JSON.stringify({ error: 'Invalid service ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (staffId && !/^[0-9a-f-]{36}$/i.test(staffId)) {
        return new Response(JSON.stringify({ error: 'Invalid staff ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
        return new Response(JSON.stringify({ error: 'Invalid booking date' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
        return new Response(JSON.stringify({ error: 'Invalid start time' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!clientName || clientName.trim().length < 2 || clientName.length > 100) {
        return new Response(JSON.stringify({ error: 'Name must be 2-100 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!clientPhone || !/^\+?[0-9]{8,15}$/.test(clientPhone.replace(/\s/g, ''))) {
        return new Response(JSON.stringify({ error: 'Invalid phone number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify service belongs to this tenant and get real pricing
      const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('tenant_id', body.tenantId)
        .eq('is_active', true)
        .single();

      if (!service) {
        return new Response(JSON.stringify({ error: 'Service not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify staff belongs to this tenant if provided
      if (staffId) {
        const { data: staffMember } = await supabase
          .from('staff')
          .select('id')
          .eq('id', staffId)
          .eq('tenant_id', body.tenantId)
          .eq('is_active', true)
          .single();

        if (!staffMember) {
          return new Response(JSON.stringify({ error: 'Staff not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Validate booking date is not in the past
      const today = new Date().toISOString().split('T')[0];
      if (bookingDate < today) {
        return new Response(JSON.stringify({ error: 'Cannot book in the past' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Calculate end time
      const [h, m] = startTime.split(':').map(Number);
      const endMinutes = h * 60 + m + service.duration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

      // Find or create client
      const sanitizedName = clientName.trim();
      const sanitizedPhone = clientPhone.replace(/\s/g, '');

      let clientId: string;
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', sanitizedPhone)
        .eq('tenant_id', body.tenantId)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: sanitizedName,
            phone: sanitizedPhone,
            email: clientEmail || null,
            tenant_id: body.tenantId,
          })
          .select('id')
          .single();

        if (clientError || !newClient) {
          console.error('Client creation error:', clientError);
          return new Response(JSON.stringify({ error: 'Failed to create client' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        clientId = newClient.id;
      }

      // Create booking with SERVER-VALIDATED data (price from DB, not client)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          client_id: clientId,
          client_name: sanitizedName,
          client_phone: sanitizedPhone,
          staff_id: staffId || null,
          service_id: service.id,
          service_name: service.name,
          service_category: service.category,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          duration: service.duration,
          price: service.price,
          deposit_amount: service.deposit_amount,
          is_online_booking: true,
          status: service.deposit_required ? 'planned' : 'confirmed',
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        return new Response(JSON.stringify({ error: 'Failed to create booking' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Handle deposit payment if required
      if (service.deposit_required && service.deposit_amount > 0) {
        const MYFATOORAH_API_KEY = Deno.env.get('MYFATOORAH_API_KEY');
        const MYFATOORAH_API = Deno.env.get('MYFATOORAH_API_URL') || 'https://apitest.myfatoorah.com';

        if (MYFATOORAH_API_KEY) {
          const origin = req.headers.get('origin') || 'https://app.lovable.dev';
          const paymentData = {
            PaymentMethodId: 0,
            CustomerName: sanitizedName,
            DisplayCurrencyIso: 'KWD',
            MobileCountryCode: '+965',
            CustomerMobile: sanitizedPhone.replace('+965', '').replace(/\s/g, ''),
            CustomerEmail: clientEmail || '',
            InvoiceValue: service.deposit_amount,
            Language: 'EN',
            CallBackUrl: `${origin}/booking/success?booking=${booking.id}`,
            ErrorUrl: `${origin}/booking/failed?booking=${booking.id}`,
            CustomerReference: booking.id,
            InvoiceItems: [{
              ItemName: `Deposit: ${service.name}`,
              Quantity: 1,
              UnitPrice: service.deposit_amount,
            }],
          };

          const paymentResponse = await fetch(`${MYFATOORAH_API}/v2/ExecutePayment`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MYFATOORAH_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentData),
          });

          const paymentResult = await paymentResponse.json();

          if (paymentResult.IsSuccess) {
            await supabase
              .from('bookings')
              .update({
                payment_id: paymentResult.Data.InvoiceId.toString(),
                payment_url: paymentResult.Data.PaymentURL,
                deposit_status: 'pending',
              })
              .eq('id', booking.id);

            await supabase.from('payment_transactions').insert({
              booking_id: booking.id,
              payment_provider: 'myfatoorah',
              invoice_id: paymentResult.Data.InvoiceId.toString(),
              amount: service.deposit_amount,
              currency: 'KWD',
              status: 'pending',
              raw_response: paymentResult,
            });

            return new Response(
              JSON.stringify({
                success: true,
                booking,
                requiresPayment: true,
                paymentUrl: paymentResult.Data.PaymentURL,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, booking, requiresPayment: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Public booking error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
