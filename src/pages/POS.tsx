import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import { useLoyaltyConfig, validatePromoCode, validateGiftCard, MAX_REDEEM_PCT } from '@/hooks/useLoyalty';
import { Input } from '@/components/ui/input';

export default function POS() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const { tenant, profile, hasRole } = useAuth();
  // Money-out gate — see ReceiptView for rationale.
  const canRefund = hasRole('owner') || hasRole('manager') || hasRole('cashier') || hasRole('inventory_clerk');
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

  // Loyalty points redemption value.  Caps by both a percentage of the
  // pre-tax subtotal AND the net discountable amount (subtotal minus
  // any manual / promo discounts already applied).  Previously the
  // calculation used fields that do not exist on the loyalty_config
  // row — kwd_per_point, max_redeem_pct, is_enabled — so it silently
  // returned NaN / 0 and the entire loyalty flow was a no-op.
  const loyaltyDiscount = useMemo(() => {
    if (!redeemPoints || !loyaltyConfig?.is_active) return 0;
    const val = Math.round(redeemPoints * Number(loyaltyConfig.redemption_rate) * 1000) / 1000;
    const cap = Math.min(
      subtotal * (MAX_REDEEM_PCT / 100),
      // Don't let loyalty stack past what's actually discountable.
      Math.max(0, subtotal - discountAmount - promoDiscount),
    );
    return Math.min(val, cap);
  }, [redeemPoints, loyaltyConfig, subtotal, discountAmount, promoDiscount]);

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
      .select('id, client_id, client_name, client_phone, staff_id, service_id, service_name, service_category, booking_date, start_time, end_time, duration, status, price, deposit_amount, deposit_status, is_online_booking, notes, pending_retail')
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

    const stagedRetail: CartItem[] = Array.isArray(booking.pending_retail)
      ? (booking.pending_retail as CartItem[]).map((r: any) => ({
          item_type: r.item_type ?? 'product',
          item_id:   r.item_id,
          item_name: r.item_name,
          item_name_ar: r.item_name_ar,
          quantity:  Number(r.quantity || 1),
          unit_price: Number(r.unit_price || 0),
          total_price: Number(r.total_price || Number(r.unit_price || 0) * Number(r.quantity || 1)),
          staff_commission_id: r.staff_commission_id || booking.staff_id || undefined,
        }))
      : [];

    setItems([serviceItem, ...stagedRetail]);
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

  const handlePaymentConfirm = async (payments: PaymentEntry[], tipSplits?: { staff_id: string; amount: number }[]) => {
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
        tip_splits: tipSplits,
      });

      if (bookingId) {
        supabase.from('bookings')
          .update({ pending_retail: [] })
          .eq('id', bookingId)
          .then(({ error }: { error: any }) => { if (error) console.warn('[pending_retail] clear failed', error); });
      }

      // Award / deduct loyalty points.  Re-reads the client balance from
      // the DB at this moment — the selectedClient prop can be stale if
      // another device (or another sale) changed the balance after the
      // current cart was assembled.
      if (selectedClient?.id && loyaltyConfig?.is_active && grandTotal > 0) {
        const pointsEarned = Math.floor(grandTotal * Number(loyaltyConfig.points_per_kwd));

        const { data: clientData } = await supabase
          .from('clients').select('loyalty_points').eq('id', selectedClient.id).single();
        const currentBalance = Number(clientData?.loyalty_points || 0);

        // Redemption concurrency guard: never debit more than the client
        // actually has right now.  If they tried to redeem 500 but only
        // 420 remain (another sale used the rest), cap the debit to 420
        // and flag it to the cashier in the toast at the end of the flow.
        const pointsSpent = Math.min(redeemPoints, currentBalance);
        const pointsShort = redeemPoints - pointsSpent;

        const netPoints  = pointsEarned - pointsSpent;
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
            note: `Redeemed for ${loyaltyDiscount.toFixed(3)} ${tenant?.currency || 'KWD'} discount`,
          });
        }
        if (pointsShort > 0) {
          toast({
            title: 'Loyalty adjustment',
            description: `Only ${pointsSpent} of the ${redeemPoints} requested points were available — balance had changed.`,
          });
        }
      }

      // Mark promo code usage — atomic, max_uses-aware RPC.
      // increment_promo_usage returns FALSE when the promo is already
      // at max_uses; the validate step should have caught that earlier,
      // but if a race happens between two concurrent sales we surface a
      // cashier toast rather than silently letting it through.
      if (promoResult?.is_valid && promoResult.id) {
        const { data: ok, error: promoErr } = await supabase
          .rpc('increment_promo_usage', { p_promo_id: promoResult.id });
        if (promoErr) console.warn('[promo] increment failed', promoErr);
        else if (ok === false) {
          toast({
            title: 'Promo not applied',
            description: 'Promo code reached its usage limit on another sale just now.',
            variant: 'destructive',
          });
        }
      }

      // Deduct gift card balance — uses real schema column `current_balance`.
      // Previous code wrote to a non-existent `balance` column and read
      // `giftCardResult.balance` (also non-existent), so every redemption
      // produced NaN and silently no-op'd the deduction.
      const giftCardPayments = payments.filter(p => p.payment_method === 'gift_card');
      const giftCardTotal = giftCardPayments.reduce((s, p) => s + p.amount, 0);
      if (giftCardResult && giftCardTotal > 0) {
        const prevBal = Number(giftCardResult.current_balance);
        const newBal  = Math.max(0, Math.round((prevBal - giftCardTotal) * 1000) / 1000);
        await supabase.from('gift_cards').update({
          current_balance: newBal,
          status: newBal <= 0 ? 'depleted' : 'active',
        }).eq('id', giftCardResult.id);
        await supabase.from('gift_card_transactions').insert({
          gift_card_id: giftCardResult.id, transaction_id: txn.id,
          type: 'redeemed', amount: -giftCardTotal, balance_after: newBal,
        });
      }

      // Cashier warning: loyalty points were earnable but no client linked,
      // so nothing was awarded.  Quiet otherwise.
      if (!selectedClient?.id && loyaltyConfig?.is_active && grandTotal > 0) {
        const wouldEarn = Math.floor(grandTotal * Number(loyaltyConfig.points_per_kwd || 0));
        if (wouldEarn > 0) {
          toast({
            title: 'No client linked',
            description: `${wouldEarn} loyalty points were not awarded — link a client before checkout to earn them.`,
          });
        }
      }

      setCompletedTxnId(txn.id);
      setCompletedPayments(payments);
      setShowPayment(false);
      setShowReceipt(true);

      // ── Auto-post journal entry to GL ─────────────────────
      // Fire-and-forget: doesn't block checkout if it fails.
      //
      // Previous code produced UNBALANCED entries on every sale that had
      // any discount, tax, or tip — revenue credits summed to subtotal,
      // payment debits summed to grand_total, and the difference was
      // silently left imbalanced.  Double-entry bookkeeping demands
      // debits = credits on every entry; violating this corrupts every
      // downstream report.
      //
      // The fix composes all lines in memory, verifies balance, and only
      // then inserts the header + lines.  If required mappings are
      // missing (so we can't produce a balanced entry), we skip posting
      // rather than write garbage.
      try {
        const { data: glMaps } = await (supabase as any)
          .from('gl_mappings')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true);

        if (glMaps && glMaps.length > 0) {
          const findMap = (type: string, key?: string) =>
            glMaps.find((m: any) => m.mapping_type === type && (!key || m.source_key === key))
            || (type === 'revenue_service' ? glMaps.find((m: any) => m.mapping_type === type && m.source_key === 'other') : undefined);

          // Compose lines in memory first so we can validate totals
          // BEFORE writing anything.
          const jeLines: { account_id: string; debit: number; credit: number; description: string }[] = [];
          const skip: string[] = [];

          // 1. Revenue (credit) — one line per cart item using pre-discount
          //    line total.  Discount is handled as a separate debit below
          //    so revenue accounts stay clean.
          for (const item of items) {
            const catKey = item.item_type || 'other';
            const revMap = findMap('revenue_service', catKey);
            const amount = Number(item.total_price || item.unit_price || 0);
            if (amount <= 0) continue;
            if (!revMap?.credit_account_id) { skip.push(`revenue_service:${catKey}`); continue; }
            jeLines.push({
              account_id: revMap.credit_account_id,
              debit: 0, credit: amount,
              description: item.item_name,
            });
          }

          // 2. Payment (debit) — one line per payment method, sums to grand_total.
          for (const pmt of payments) {
            const pmtMap = findMap('payment_method', pmt.payment_method);
            if (!pmtMap?.debit_account_id) { skip.push(`payment_method:${pmt.payment_method}`); continue; }
            if (pmt.amount <= 0) continue;
            jeLines.push({
              account_id: pmtMap.debit_account_id,
              debit: pmt.amount, credit: 0,
              description: pmt.payment_method,
            });
          }

          // 3. Discount (debit, contra-revenue) — reduces net revenue.
          if (totalDiscount > 0) {
            const dMap = findMap('sales_discount');
            if (dMap?.debit_account_id) {
              jeLines.push({
                account_id: dMap.debit_account_id,
                debit: totalDiscount, credit: 0,
                description: 'Sales discount',
              });
            } else {
              skip.push('sales_discount');
            }
          }

          // 4. Tax (credit, liability).
          if (taxAmount > 0) {
            const tMap = findMap('sales_tax');
            if (tMap?.credit_account_id) {
              jeLines.push({
                account_id: tMap.credit_account_id,
                debit: 0, credit: taxAmount,
                description: 'Sales tax',
              });
            } else {
              skip.push('sales_tax');
            }
          }

          // 5. Tip (credit, liability — to be paid out to staff).
          if (tipAmount > 0) {
            const tipMap = findMap('tip');
            if (tipMap?.credit_account_id) {
              jeLines.push({
                account_id: tipMap.credit_account_id,
                debit: 0, credit: tipAmount,
                description: 'Tip (staff payable)',
              });
            } else {
              skip.push('tip');
            }
          }

          // 6. Balance check.  Sum debits and credits with fil-level
          //    tolerance (one-thousandth).  If imbalanced, refuse to
          //    post — better to lose a journal entry than to poison the
          //    ledger.  Mappings needed to balance will be logged for
          //    the admin to provision.
          const totalDebit  = jeLines.reduce((s, l) => s + Number(l.debit || 0), 0);
          const totalCredit = jeLines.reduce((s, l) => s + Number(l.credit || 0), 0);
          const imbalance   = Math.round((totalDebit - totalCredit) * 1000) / 1000;

          if (jeLines.length === 0 || Math.abs(imbalance) > 0.001 || skip.length > 0) {
            // Do not write an unbalanced or empty entry.  Noisy in dev,
            // invisible in prod (fire-and-forget try/catch swallows).
            console.warn('[GL] Skipping POS journal entry — ', {
              imbalance, totalDebit, totalCredit, missingMappings: skip,
            });
          } else {
            // 7. Entry number with light retry for the inherent race on
            //    max()+1.  If the unique constraint rejects our number,
            //    re-read and try the next one.  Three attempts is enough
            //    for practical contention.
            const year = new Date().getFullYear();
            let inserted: { id: string } | null = null;
            for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
              const { data: existing } = await (supabase as any)
                .from('journal_entries').select('entry_number')
                .eq('tenant_id', tenant!.id)
                .like('entry_number', `POS-${year}-%`)
                .order('entry_number', { ascending: false }).limit(1);
              const lastNum = existing?.[0]?.entry_number?.split('-')[2] || '0000';
              const nextNum = String(parseInt(lastNum) + 1 + attempt).padStart(4, '0');

              // 8. Insert header as NOT posted until lines succeed.  An
              //    orphan unposted header is harmless — an orphan posted
              //    header corrupts reports.
              const { data: je, error: jeErr } = await (supabase as any).from('journal_entries').insert({
                tenant_id: tenant!.id,
                entry_number: `POS-${year}-${nextNum}`,
                entry_date: new Date().toISOString().split('T')[0],
                source: 'pos',
                source_ref_id: txn.id,
                source_ref_type: 'transaction',
                description: `POS Sale — ${txn.id.slice(0,8)}`,
                is_posted: false,
              }).select('id').single();

              if (!jeErr && je) inserted = je;
              // otherwise retry with next number
            }

            if (inserted) {
              const payload = jeLines.map(l => ({ ...l, journal_entry_id: inserted!.id }));
              const { error: linesErr } = await (supabase as any).from('journal_lines').insert(payload);
              if (!linesErr) {
                // Only now mark the header as posted.
                await (supabase as any).from('journal_entries')
                  .update({ is_posted: true })
                  .eq('id', inserted.id);
              } else {
                // Roll back the header if lines failed so we don't
                // leave an unposted skeleton behind.
                await (supabase as any).from('journal_entries')
                  .delete().eq('id', inserted.id);
                console.warn('[GL] Lines insert failed, JE rolled back', linesErr);
              }
            }
          }
        }
      } catch (e) { console.warn('[GL] POS posting error (non-fatal):', e); }
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
            {paidTransaction && canRefund && (
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
            {selectedClient && loyaltyConfig?.is_active && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500"/>
                    {(selectedClient as any).loyalty_points || 0} points available
                    {loyaltyConfig && <span>· {(((selectedClient as any).loyalty_points || 0) * Number(loyaltyConfig.redemption_rate)).toFixed(3)} {tenant?.currency || 'KWD'} value</span>}
                  </span>
                </div>
                {((selectedClient as any).loyalty_points || 0) >= Number(loyaltyConfig.min_redemption) && (
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
        currency={tenant?.currency || 'KWD'}
        tipAmount={tipAmount}
        items={items}
        maxByMethod={{
          gift_card: Number(giftCardResult?.current_balance ?? 0),
        }}
        giftCardCode={giftCardCode}
        giftCardError={giftCardError}
        giftCardLinked={giftCardResult ? {
          code: giftCardResult.code,
          balance: Number(giftCardResult.current_balance),
        } : null}
        onGiftCardCodeChange={setGiftCardCode}
        onLookupGiftCard={handleApplyGiftCard}
        onClearGiftCard={() => { setGiftCardResult(null); setGiftCardCode(''); setGiftCardError(''); }}
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
                // min-h-11 (44px) meets mobile touch target guidance.
                // Text stays single-line and density is unchanged on
                // desktop where h is set by line-height, not min-h.
                className="w-full flex items-center justify-between p-2 min-h-11 rounded hover:bg-accent/10 text-left text-sm"
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
