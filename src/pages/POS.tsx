import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClientSelector } from '@/components/pos/ClientSelector';
import { POSCart } from '@/components/pos/POSCart';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { ReceiptView } from '@/components/pos/ReceiptView';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateTransaction, type CartItem, type PaymentEntry } from '@/hooks/useTransactions';
import { useStaff } from '@/hooks/useStaff';
import type { Client } from '@/hooks/useClients';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { ShoppingCart, CalendarCheck, RotateCcw, Tag, Star, X, Loader2, AlertTriangle } from 'lucide-react';
import { RefundDialog } from '@/components/pos/RefundDialog';
import { useTransactionById } from '@/hooks/useTransactions';
import { useLoyaltyConfig, validatePromoCode, validateGiftCard } from '@/hooks/useLoyalty';
import { Input } from '@/components/ui/input';

export default function POS() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const { tenant, profile } = useAuth();
  const { data: staffList } = useStaff();
  const createTransaction = useCreateTransaction();

  // Fetch the authenticated user's email for correct staff lookup (Bug 5 fix)
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthEmail(data.user?.email || null);
    });
  }, []);

  // Client state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Cart state
  const [items, setItems] = useState<CartItem[]>([]);
  const [tipAmount, setTipAmount] = useState(0);
  const [discountType, setDiscountType] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [discountApprovedBy, setDiscountApprovedBy] = useState<string | null>(null);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showRefund,  setShowRefund]  = useState(false);
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);
  const [completedPayments, setCompletedPayments] = useState<PaymentEntry[]>([]);

  // For refund: fetch the completed transaction linked to this booking
  const [paidTxnId, setPaidTxnId] = useState<string | null>(null);
  const { data: paidTransaction } = useTransactionById(paidTxnId);

  // Loyalty & Promo
  const { data: loyaltyConfig } = useLoyaltyConfig();
  const [promoCode,        setPromoCode]        = useState('');
  const [promoResult,      setPromoResult]      = useState<any>(null);
  const [promoError,       setPromoError]       = useState('');
  const [promoLoading,     setPromoLoading]     = useState(false);
  const [redeemPoints,     setRedeemPoints]     = useState(0);  // points client wants to redeem
  const [giftCardCode,     setGiftCardCode]     = useState('');
  const [giftCardResult,   setGiftCardResult]   = useState<any>(null);
  const [giftCardError,    setGiftCardError]    = useState('');

  // Bug 5 fix: match staff by the authenticated user's email (not full_name)
  // Falls back to first active staff member if the logged-in user is not a staff record
  const currentStaff = useMemo(() => {
    if (!staffList) return null;
    if (authEmail) {
      const matched = staffList.find(s => s.email && s.email.toLowerCase() === authEmail.toLowerCase());
      if (matched) return matched;
    }
    return staffList.find(s => s.is_active) || staffList[0] || null;
  }, [staffList, authEmail]);

  // Calculated values
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = useMemo(() => {
    if (!discountApprovedBy || !discountType) return 0;
    if (discountType === 'percentage') return Math.round(subtotal * (discountValue / 100) * 1000) / 1000;
    return Math.min(discountValue, subtotal);
  }, [discountType, discountValue, subtotal, discountApprovedBy]);

  // Promo discount
  const promoDiscount = promoResult?.is_valid ? Number(promoResult.discount_amount) : 0;

  // Loyalty points redemption value
  const loyaltyDiscount = useMemo(() => {
    if (!redeemPoints || !loyaltyConfig?.is_enabled) return 0;
    const val = Math.round(redeemPoints * loyaltyConfig.kwd_per_point * 1000) / 1000;
    const maxPct = loyaltyConfig.max_redeem_pct / 100;
    return Math.min(val, subtotal * maxPct);
  }, [redeemPoints, loyaltyConfig, subtotal]);

  const totalDiscount  = Math.round((discountAmount + promoDiscount + loyaltyDiscount) * 1000) / 1000;
  const taxRate = Number(tenant?.default_tax_rate || 0) / 100;
  const taxAmount = Math.round((subtotal - totalDiscount) * taxRate * 1000) / 1000;
  const grandTotal = Math.round((subtotal - totalDiscount + taxAmount + tipAmount) * 1000) / 1000;

  // Whether this booking has already been paid — blocks all checkout UI
  const [bookingAlreadyPaid, setBookingAlreadyPaid] = useState(false);
  // Whether this booking was marked complete but payment was never collected.
  // Shows a recovery banner and ALLOWS the cart to load so payment can be taken.
  const [completedNoPayment, setCompletedNoPayment] = useState(false);

  // Load booking if bookingId provided
  useEffect(() => {
    if (bookingId) {
      loadBooking(bookingId);
    }
  }, [bookingId]);

  const loadBooking = async (id: string) => {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, client_id, client_name, client_phone, staff_id, service_id, service_name, service_category, booking_date, start_time, end_time, duration, status, price, deposit_amount, deposit_status, is_online_booking, notes')
      .eq('id', id)
      .single();

    if (!booking) return;

    // ── PAYMENT GUARD — single source of truth ─────────────────
    // Check for an existing completed transaction.  booking.status alone
    // is NOT sufficient — the service can be marked 'completed' while
    // payment is still pending (e.g. marked complete from the Calendar
    // dropdown without going through POS).  We must verify in transactions.
    const { data: existingTxn } = await supabase
      .from('transactions')
      .select('id')
      .eq('booking_id', id)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingTxn) {
      // Genuinely paid — lock POS and expose the refund path.
      setBookingAlreadyPaid(true);
      setPaidTxnId(existingTxn.id);
      if (booking.client_id) {
        const { data: client } = await supabase
          .from('clients').select('id, name, phone, email, tier, loyalty_points, tenant_id').eq('id', booking.client_id).single();
        if (client) setSelectedClient(client as Client);
      }
      return; // payment already recorded — do NOT load cart
    }

    // Booking may be in 'completed' status without a matching transaction —
    // surface it as a recovery scenario, but still allow the cart to load
    // so reception can collect the payment that was missed.
    if (booking.status === 'completed') {
      setCompletedNoPayment(true);
    }

    // ── Safe to load — booking not yet paid ──────────────────
    if (booking.client_id) {
      const { data: client } = await supabase
        .from('clients').select('id, name, phone, email, tier, loyalty_points, tenant_id').eq('id', booking.client_id).single();
      if (client) setSelectedClient(client as Client);
    } else {
      setIsGuest(true);
    }

    // Use effective price (respects time-windowed price schedules)
    let effectivePrice = Number(booking.price);
    if (booking.service_id) {
      const { data: ep } = await supabase
        .rpc('get_effective_price', { p_service_id: booking.service_id });
      if (ep !== null && ep !== undefined) effectivePrice = Number(ep);
    }

    const serviceItem: CartItem = {
      item_type: 'service',
      item_id: booking.service_id || '',
      item_name: booking.service_name,
      quantity: 1,
      unit_price: effectivePrice,
      total_price: effectivePrice,
      // Capture staff for commission calculation
      staff_commission_id: booking.staff_id || undefined,
    };

    if (booking.service_id) {
      const { data: service } = await supabase
        .from('services').select('name_ar').eq('id', booking.service_id).single();
      if (service?.name_ar) serviceItem.item_name_ar = service.name_ar;
    }

    setItems([serviceItem]);
  };

  const handleDiscountChange = (type: string | null, value: number, reason: string) => {
    setDiscountType(type);
    setDiscountValue(value);
    setDiscountReason(reason);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !tenant?.id) return;
    setPromoLoading(true); setPromoError('');
    try {
      const result = await validatePromoCode(tenant.id, promoCode.trim(), subtotal);
      if (result?.is_valid) { setPromoResult(result); setPromoError(''); }
      else { setPromoResult(null); setPromoError(result?.error_msg || 'Invalid promo code'); }
    } catch { setPromoError('Failed to validate code'); }
    finally { setPromoLoading(false); }
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim() || !tenant?.id) return;
    setGiftCardError('');
    const card = await validateGiftCard(tenant.id, giftCardCode.trim());
    if (card) { setGiftCardResult(card); setGiftCardError(''); }
    else setGiftCardError('Gift card not found or depleted');
  };

  const handleCheckout = () => { setShowPayment(true); };

  const handlePaymentConfirm = async (payments: PaymentEntry[]) => {
    if (bookingAlreadyPaid || createTransaction.isPending) return;
    try {
      const txn = await createTransaction.mutateAsync({
        client_id: selectedClient?.id || null,
        staff_id: currentStaff?.id || null,
        booking_id: bookingId || null,
        items,
        payments,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: totalDiscount,
        discount_reason: [discountReason, promoResult?.is_valid ? `Promo: ${promoCode}` : '', redeemPoints ? `Loyalty: ${redeemPoints}pts` : ''].filter(Boolean).join(' | '),
        discount_approved_by: discountApprovedBy,
        tax_amount: taxAmount,
        tip_amount: tipAmount,
        grand_total: grandTotal,
      });

      // Award loyalty points to client
      if (selectedClient?.id && loyaltyConfig?.is_enabled && grandTotal > 0) {
        const pointsEarned = Math.floor(grandTotal * loyaltyConfig.points_per_kwd);
        const pointsSpent  = redeemPoints;
        const netPoints    = pointsEarned - pointsSpent;

        // Get current balance
        const { data: clientData } = await supabase
          .from('clients').select('loyalty_points').eq('id', selectedClient.id).single();
        const currentBalance = Number(clientData?.loyalty_points || 0);
        const newBalance = Math.max(0, currentBalance + netPoints);

        await supabase.from('clients').update({ loyalty_points: newBalance }).eq('id', selectedClient.id);

        if (pointsEarned > 0) {
          await supabase.from('loyalty_transactions').insert({
            tenant_id: tenant!.id, client_id: selectedClient.id,
            transaction_id: txn.id, type: 'earn',
            points: pointsEarned, balance_after: currentBalance + pointsEarned,
            note: `Earned from sale ${txn.id.slice(0,8)}`,
          });
        }
        if (pointsSpent > 0) {
          await supabase.from('loyalty_transactions').insert({
            tenant_id: tenant!.id, client_id: selectedClient.id,
            transaction_id: txn.id, type: 'redeem',
            points: -pointsSpent, balance_after: newBalance,
            note: `Redeemed for ${loyaltyDiscount.toFixed(3)} KWD discount`,
          });
        }
      }

      // Mark promo code usage
      if (promoResult?.is_valid && promoResult.id) {
        await supabase.from('promo_codes')
          .update({ usage_count: supabase.rpc as any })
          .eq('id', promoResult.id);
        // Use raw SQL increment via rpc workaround
        await supabase.rpc('increment_promo_usage' as any, { p_id: promoResult.id }).catch(() => {
          // Fallback: fetch and increment manually
          supabase.from('promo_codes').select('usage_count').eq('id', promoResult.id).single()
            .then(({ data }) => {
              if (data) supabase.from('promo_codes')
                .update({ usage_count: data.usage_count + 1 }).eq('id', promoResult.id);
            });
        });
      }

      // Deduct gift card balance if used
      if (giftCardResult) {
        const gcPayment = payments.find(p => p.payment_method === 'gift_card');
        if (gcPayment) {
          const newBal = Math.max(0, Number(giftCardResult.balance) - gcPayment.amount);
          await supabase.from('gift_cards').update({
            balance: newBal, status: newBal <= 0 ? 'depleted' : 'active',
          }).eq('id', giftCardResult.id);
          await supabase.from('gift_card_transactions').insert({
            gift_card_id: giftCardResult.id, transaction_id: txn.id,
            type: 'redeemed', amount: -gcPayment.amount, balance_after: newBal,
          });
        }
      }

      setCompletedTxnId(txn.id);
      setCompletedPayments(payments);
      setShowPayment(false);
      setShowReceipt(true);

      // ── Auto-post journal entry to GL ─────────────────────
      // Fire-and-forget: doesn't block checkout if it fails
      try {
        const { data: glMaps } = await (supabase as any)
          .from('gl_mappings')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true);

        if (glMaps && glMaps.length > 0) {
          const year = new Date().getFullYear();
          const { data: existing } = await (supabase as any)
            .from('journal_entries').select('entry_number')
            .eq('tenant_id', tenant!.id)
            .like('entry_number', `POS-${year}-%`)
            .order('entry_number', { ascending: false }).limit(1);
          const lastNum = existing?.[0]?.entry_number?.split('-')[2] || '0000';
          const nextNum = String(parseInt(lastNum) + 1).padStart(4, '0');

          const { data: je } = await (supabase as any).from('journal_entries').insert({
            tenant_id: tenant!.id,
            entry_number: `POS-${year}-${nextNum}`,
            entry_date: new Date().toISOString().split('T')[0],
            source: 'pos',
            source_ref_id: txn.id,
            source_ref_type: 'transaction',
            description: `POS Sale — ${txn.id.slice(0,8)}`,
            is_posted: true,
          }).select().single();

          if (je) {
            const jeLines: any[] = [];
            // Revenue lines — one per service category in the sale
            for (const item of items) {
              const catKey = item.item_type || 'other';
              const revMap = glMaps.find((m: any) => m.mapping_type === 'revenue_service' && m.source_key === catKey)
                          || glMaps.find((m: any) => m.mapping_type === 'revenue_service' && m.source_key === 'other');
              if (revMap?.credit_account_id) {
                jeLines.push({ journal_entry_id: je.id, account_id: revMap.credit_account_id, debit: 0, credit: item.total_price || item.unit_price, description: item.item_name });
              }
            }
            // Payment (debit) lines — one per payment method
            for (const pmt of payments) {
              const pmtMap = glMaps.find((m: any) => m.mapping_type === 'payment_method' && m.source_key === pmt.payment_method);
              if (pmtMap?.debit_account_id) {
                jeLines.push({ journal_entry_id: je.id, account_id: pmtMap.debit_account_id, debit: pmt.amount, credit: 0, description: pmt.payment_method });
              }
            }
            if (jeLines.length > 0) {
              await (supabase as any).from('journal_lines').insert(jeLines);
            }
          }
        }
      } catch { /* silent — GL posting is best-effort */ }
    } catch (err) { /* handled by mutation */ }
  };

  const handleNewSale = () => {
    setItems([]);
    setTipAmount(0);
    setDiscountType(null);
    setDiscountValue(0);
    setDiscountReason('');
    setDiscountApprovedBy(null);
    setSelectedClient(null);
    setIsGuest(false);
    setShowReceipt(false);
    setCompletedTxnId(null);
    setCompletedPayments([]);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* Left panel: Client & mode selection */}
      <div className="lg:w-80 xl:w-96 shrink-0 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              {bookingId ? (
                <CalendarCheck className="h-5 w-5 text-primary" />
              ) : (
                <ShoppingCart className="h-5 w-5 text-primary" />
              )}
              <h2 className="text-lg font-semibold text-foreground">
                {bookingId ? 'Appointment Checkout' : 'Walk-in / Retail'}
              </h2>
            </div>
            <ClientSelector
              selectedClient={selectedClient}
              isGuest={isGuest}
              onSelectClient={(c) => { setSelectedClient(c); setIsGuest(false); }}
              onSelectGuest={() => { setIsGuest(true); setSelectedClient(null); }}
              onClear={() => { setSelectedClient(null); setIsGuest(false); }}
            />
          </CardContent>
        </Card>

        {/* Service quick-add for walk-in */}
        {!bookingId && (selectedClient || isGuest) && (
          <ServiceQuickAdd
            items={items}
            onItemsChange={setItems}
          />
        )}
      </div>

      {/* Right panel: Cart */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ── Already-paid guard banner ── */}
        {bookingAlreadyPaid && (
          <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800">
            <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                Already paid
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                This appointment has already been checked out. No further payment can be taken.
              </p>
            </div>
            {paidTransaction && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRefund(true)}
                className="flex-shrink-0 h-8 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Refund
              </Button>
            )}
          </div>
        )}
        {/* ── Recovery banner: service marked complete but unpaid ── */}
        {completedNoPayment && !bookingAlreadyPaid && (
          <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Payment not yet collected
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                This service was marked complete but no payment has been recorded. Collect it now.
              </p>
            </div>
          </div>
        )}
        <POSCart
          items={bookingAlreadyPaid ? [] : items}
          onItemsChange={bookingAlreadyPaid ? () => {} : setItems}
          tipAmount={tipAmount}
          onTipChange={bookingAlreadyPaid ? () => {} : setTipAmount}
          discountType={discountType}
          discountValue={discountValue}
          discountAmount={discountAmount}
          discountReason={discountReason}
          discountApprovedBy={discountApprovedBy}
          onDiscountChange={bookingAlreadyPaid ? () => {} : handleDiscountChange}
          onDiscountApproved={bookingAlreadyPaid ? () => {} : setDiscountApprovedBy}
          onCheckout={bookingAlreadyPaid ? () => {} : handleCheckout}
          checkoutDisabled={bookingAlreadyPaid}
        />

        {/* ── Promo Code + Loyalty Panel ── */}
        {!bookingAlreadyPaid && items.length > 0 && (
          <div className="px-4 pb-3 space-y-2 border-t pt-3">
            {/* Promo Code */}
            <div className="space-y-1">
              <div className="flex gap-1.5">
                <Input
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(''); }}
                  placeholder="Promo code"
                  className="h-8 text-xs font-mono flex-1"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-shrink-0"
                  onClick={handleApplyPromo} disabled={!promoCode.trim() || promoLoading}>
                  {promoLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Tag className="h-3 w-3"/>}
                  Apply
                </Button>
                {promoResult?.is_valid && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground"
                    onClick={() => { setPromoResult(null); setPromoCode(''); }}>
                    <X className="h-3 w-3"/>
                  </Button>
                )}
              </div>
              {promoResult?.is_valid && (
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3"/>✓ -{promoDiscount.toFixed(3)} KWD discount applied
                </p>
              )}
              {promoError && <p className="text-[11px] text-destructive">{promoError}</p>}
            </div>

            {/* Loyalty Points Redemption */}
            {selectedClient && loyaltyConfig?.is_enabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500"/>
                    {(selectedClient as any).loyalty_points || 0} points available
                    {loyaltyConfig && <span>· {(((selectedClient as any).loyalty_points || 0) * loyaltyConfig.kwd_per_point).toFixed(3)} KWD value</span>}
                  </span>
                </div>
                {((selectedClient as any).loyalty_points || 0) >= loyaltyConfig.min_redeem_points && (
                  <div className="flex gap-1.5">
                    <Input
                      type="number" min="0" max={(selectedClient as any).loyalty_points || 0}
                      value={redeemPoints || ''}
                      onChange={e => setRedeemPoints(Math.min(Number(e.target.value), (selectedClient as any).loyalty_points || 0))}
                      placeholder="Points to redeem"
                      className="h-8 text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-shrink-0"
                      onClick={() => setRedeemPoints((selectedClient as any).loyalty_points || 0)}>
                      Max
                    </Button>
                    {redeemPoints > 0 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRedeemPoints(0)}>
                        <X className="h-3 w-3"/>
                      </Button>
                    )}
                  </div>
                )}
                {redeemPoints > 0 && (
                  <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Star className="h-3 w-3"/>✓ -{loyaltyDiscount.toFixed(3)} KWD from {redeemPoints} points
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Payment dialog */}
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        grandTotal={grandTotal}
        onConfirm={handlePaymentConfirm}
        loading={createTransaction.isPending}
      />

      {/* Receipt dialog */}
      {completedTxnId && (
        <ReceiptView
          open={showReceipt}
          onOpenChange={(open) => {
            setShowReceipt(open);
            if (!open) handleNewSale();
          }}
          transactionId={completedTxnId}
          items={items}
          payments={completedPayments}
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          tipAmount={tipAmount}
          grandTotal={grandTotal}
          clientName={selectedClient?.name || (isGuest ? 'Guest' : undefined)}
          staffName={currentStaff?.name}
          createdAt={new Date().toISOString()}
        />
      )}
      {/* Refund dialog — accessible from already-paid banner */}
      <RefundDialog
        open={showRefund}
        onOpenChange={setShowRefund}
        transaction={paidTransaction as any}
        onRefundComplete={() => setShowRefund(false)}
      />
    </div>
  );
}

// Quick-add services component for walk-in mode
function ServiceQuickAdd({ items, onItemsChange }: { items: CartItem[]; onItemsChange: (items: CartItem[]) => void }) {
  const [search, setSearch] = useState('');
  const { data: services } = useServicesQuery(search);

  const addService = (service: any) => {
    const exists = items.find(i => i.item_type === 'service' && i.item_id === service.id);
    if (exists) return;

    onItemsChange([...items, {
      item_type: 'service',
      item_id: service.id,
      item_name: service.name,
      item_name_ar: service.name_ar || undefined,
      quantity: 1,
      unit_price: Number(service.price),
      total_price: Number(service.price),
    }]);
    setSearch('');
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-foreground">Add Service</h3>
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
        />
        {search && services && services.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {services.filter(s => s.is_active).map((service) => (
              <button
                key={service.id}
                onClick={() => addService(service)}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-accent/10 text-left text-sm"
              >
                <span className="truncate text-foreground">{service.name}</span>
                <span className="text-muted-foreground ml-2 shrink-0">{Number(service.price).toFixed(3)} KWD</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple services query for quick add
import { useQuery } from '@tanstack/react-query';

function useServicesQuery(search: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['services', tenant?.id, search],
    queryFn: async () => {
      let query = supabase.from('services').select('id, name, name_ar, category, duration, price, color, is_active, deposit_required, deposit_amount').eq('is_active', true).order('name');
      if (search?.trim()) {
        query = query.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!search,
  });
}
