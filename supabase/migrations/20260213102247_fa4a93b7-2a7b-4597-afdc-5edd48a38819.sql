
-- Create enums
CREATE TYPE public.transaction_status AS ENUM ('completed', 'refunded', 'voided');
CREATE TYPE public.pos_payment_method AS ENUM ('cash', 'knet', 'credit_card', 'gift_card');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID REFERENCES public.clients(id),
  staff_id UUID REFERENCES public.staff(id),
  booking_id UUID REFERENCES public.bookings(id),
  subtotal NUMERIC(10,3) NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC(10,3) DEFAULT 0,
  discount_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  discount_approved_by UUID,
  tax_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  tip_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  grand_total NUMERIC(10,3) NOT NULL DEFAULT 0,
  status transaction_status NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transaction_items table
CREATE TABLE public.transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  item_name_ar TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,3) NOT NULL,
  total_price NUMERIC(10,3) NOT NULL,
  staff_commission_id UUID REFERENCES public.staff(id)
);

-- Create transaction_payments table
CREATE TABLE public.transaction_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  payment_method pos_payment_method NOT NULL,
  amount NUMERIC(10,3) NOT NULL
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can view their tenant transactions"
  ON public.transactions FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Authorized staff can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
    )
  );

CREATE POLICY "Authorized staff can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- Transaction items policies
CREATE POLICY "Users can view transaction items"
  ON public.transaction_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_items.transaction_id
    AND ((t.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  ));

CREATE POLICY "Authorized staff can create transaction items"
  ON public.transaction_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_items.transaction_id
    AND t.tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
    )
  ));

-- Transaction payments policies
CREATE POLICY "Users can view transaction payments"
  ON public.transaction_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_payments.transaction_id
    AND ((t.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
  ));

CREATE POLICY "Authorized staff can create transaction payments"
  ON public.transaction_payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_payments.transaction_id
    AND t.tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
    )
  ));

-- Add updated_at trigger to transactions
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
