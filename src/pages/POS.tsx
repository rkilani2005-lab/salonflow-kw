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
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, CalendarCheck } from 'lucide-react';

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
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);
  const [completedPayments, setCompletedPayments] = useState<PaymentEntry[]>([]);

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

  const taxRate = Number(tenant?.default_tax_rate || 0) / 100;
  const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 1000) / 1000;
  const grandTotal = Math.round((subtotal - discountAmount + taxAmount + tipAmount) * 1000) / 1000;

  // Load booking if bookingId provided
  useEffect(() => {
    if (bookingId) {
      loadBooking(bookingId);
    }
  }, [bookingId]);

  const loadBooking = async (id: string) => {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (booking) {
      // Set client
      if (booking.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('*')
          .eq('id', booking.client_id)
          .single();
        if (client) setSelectedClient(client as Client);
      } else {
        setIsGuest(true);
      }

      // Add service to cart
      const serviceItem: CartItem = {
        item_type: 'service',
        item_id: booking.service_id || '',
        item_name: booking.service_name,
        quantity: 1,
        unit_price: Number(booking.price),
        total_price: Number(booking.price),
      };

      // Try to get Arabic name
      if (booking.service_id) {
        const { data: service } = await supabase
          .from('services')
          .select('name_ar')
          .eq('id', booking.service_id)
          .single();
        if (service?.name_ar) serviceItem.item_name_ar = service.name_ar;
      }

      setItems([serviceItem]);
    }
  };

  const handleDiscountChange = (type: string | null, value: number, reason: string) => {
    setDiscountType(type);
    setDiscountValue(value);
    setDiscountReason(reason);
  };

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (payments: PaymentEntry[]) => {
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
        discount_amount: discountAmount,
        discount_reason: discountReason,
        discount_approved_by: discountApprovedBy,
        tax_amount: taxAmount,
        tip_amount: tipAmount,
        grand_total: grandTotal,
      });

      setCompletedTxnId(txn.id);
      setCompletedPayments(payments);
      setShowPayment(false);
      setShowReceipt(true);
    } catch (err) {
      // Error handled by mutation
    }
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
        <POSCart
          items={items}
          onItemsChange={setItems}
          tipAmount={tipAmount}
          onTipChange={setTipAmount}
          discountType={discountType}
          discountValue={discountValue}
          discountAmount={discountAmount}
          discountReason={discountReason}
          discountApprovedBy={discountApprovedBy}
          onDiscountChange={handleDiscountChange}
          onDiscountApproved={setDiscountApprovedBy}
          onCheckout={handleCheckout}
        />
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
      let query = supabase.from('services').select('*').eq('is_active', true).order('name');
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
