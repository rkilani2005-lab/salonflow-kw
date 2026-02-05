import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 // MyFatoorah API endpoint (Kuwait production)
 const MYFATOORAH_API = Deno.env.get('MYFATOORAH_API_URL') || 'https://apitest.myfatoorah.com';
 
 interface PaymentRequest {
   action: 'create' | 'callback' | 'status';
   bookingId?: string;
   amount?: number;
   clientName?: string;
   clientPhone?: string;
   clientEmail?: string;
   serviceName?: string;
   paymentId?: string;
 }
 
 serve(async (req: Request) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const MYFATOORAH_API_KEY = Deno.env.get('MYFATOORAH_API_KEY');
     if (!MYFATOORAH_API_KEY) {
       throw new Error('MyFatoorah API key not configured');
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const { action, bookingId, amount, clientName, clientPhone, clientEmail, serviceName, paymentId } = await req.json() as PaymentRequest;
 
     if (action === 'create') {
       // Create MyFatoorah payment
       if (!bookingId || !amount || !clientName) {
         throw new Error('Missing required fields: bookingId, amount, clientName');
       }
 
       const callbackUrl = `${supabaseUrl}/functions/v1/myfatoorah-payment`;
 
       const paymentData = {
         PaymentMethodId: 0, // Let customer choose
         CustomerName: clientName,
         DisplayCurrencyIso: 'KWD',
         MobileCountryCode: '+965',
         CustomerMobile: clientPhone?.replace('+965', '').replace(/\s/g, '') || '',
         CustomerEmail: clientEmail || '',
         InvoiceValue: amount,
         Language: 'EN',
         CallBackUrl: `${req.headers.get('origin') || 'https://app.lovable.dev'}/booking/success?booking=${bookingId}`,
         ErrorUrl: `${req.headers.get('origin') || 'https://app.lovable.dev'}/booking/failed?booking=${bookingId}`,
         CustomerReference: bookingId,
         InvoiceItems: [{
           ItemName: serviceName || 'Appointment Deposit',
           Quantity: 1,
           UnitPrice: amount,
         }],
       };
 
       console.log('Creating MyFatoorah payment:', paymentData);
 
       const response = await fetch(`${MYFATOORAH_API}/v2/ExecutePayment`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${MYFATOORAH_API_KEY}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(paymentData),
       });
 
       const result = await response.json();
       console.log('MyFatoorah response:', result);
 
       if (!result.IsSuccess) {
         throw new Error(result.Message || 'Failed to create payment');
       }
 
       // Update booking with payment info
       const { error: updateError } = await supabase
         .from('bookings')
         .update({
           payment_id: result.Data.InvoiceId.toString(),
           payment_url: result.Data.PaymentURL,
           deposit_status: 'pending',
         })
         .eq('id', bookingId);
 
       if (updateError) {
         console.error('Error updating booking:', updateError);
       }
 
       // Log transaction
       await supabase.from('payment_transactions').insert({
         booking_id: bookingId,
         payment_provider: 'myfatoorah',
         invoice_id: result.Data.InvoiceId.toString(),
         amount: amount,
         currency: 'KWD',
         status: 'pending',
         raw_response: result,
       });
 
       return new Response(
         JSON.stringify({ 
           success: true, 
           paymentUrl: result.Data.PaymentURL,
           invoiceId: result.Data.InvoiceId,
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     if (action === 'status') {
       // Check payment status
       if (!paymentId) {
         throw new Error('Missing paymentId');
       }
 
       const response = await fetch(`${MYFATOORAH_API}/v2/GetPaymentStatus`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${MYFATOORAH_API_KEY}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ Key: paymentId, KeyType: 'InvoiceId' }),
       });
 
       const result = await response.json();
       console.log('Payment status:', result);
 
       if (!result.IsSuccess) {
         throw new Error(result.Message || 'Failed to get payment status');
       }
 
       const invoiceStatus = result.Data.InvoiceStatus;
       const isPaid = invoiceStatus === 'Paid';
 
       // Update booking if paid
       if (isPaid && result.Data.CustomerReference) {
         await supabase
           .from('bookings')
           .update({
             deposit_status: 'paid',
             status: 'confirmed',
           })
           .eq('id', result.Data.CustomerReference);
 
         // Update transaction
         await supabase
           .from('payment_transactions')
           .update({
             status: 'paid',
             transaction_id: result.Data.InvoiceTransactions?.[0]?.TransactionId,
             raw_response: result,
           })
           .eq('invoice_id', paymentId);
       }
 
       return new Response(
         JSON.stringify({ 
           success: true, 
           status: invoiceStatus,
           isPaid,
           data: result.Data,
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     throw new Error('Invalid action');
 
   } catch (error) {
     console.error('Payment error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
       { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });