
-- Create enum for stock take session status
CREATE TYPE public.stock_take_status AS ENUM ('open', 'in_progress', 'reviewing', 'completed');

-- Create enum for stock take scope
CREATE TYPE public.stock_take_scope AS ENUM ('full_store', 'retail_only', 'professional_only', 'category');

-- Create enum for entry status
CREATE TYPE public.stock_take_entry_status AS ENUM ('pending', 'counted', 'recounting', 'accepted');

-- Create enum for variance reason
CREATE TYPE public.stock_take_variance_reason AS ENUM ('theft', 'broken', 'expired', 'data_entry_error', 'supplier_shortage', 'unrecorded_sale', 'other');

-- Stock Take Sessions (Header)
CREATE TABLE public.stock_take_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  session_name TEXT NOT NULL,
  scope stock_take_scope NOT NULL DEFAULT 'full_store',
  scope_filter_id UUID NULL, -- category_id if scope = 'category'
  status stock_take_status NOT NULL DEFAULT 'open',
  assigned_staff_ids UUID[] DEFAULT '{}',
  created_by UUID NULL,
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  completed_by UUID NULL,
  notes TEXT NULL,
  total_variance_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stock Take Entries (Line Items)
CREATE TABLE public.stock_take_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.stock_take_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  system_quantity NUMERIC NOT NULL DEFAULT 0,
  counted_quantity NUMERIC NULL,
  variance NUMERIC GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - system_quantity) STORED,
  unit_cost NUMERIC NOT NULL DEFAULT 0, -- WAC at time of count
  variance_value NUMERIC GENERATED ALWAYS AS ((COALESCE(counted_quantity, 0) - system_quantity) * unit_cost) STORED,
  status stock_take_entry_status NOT NULL DEFAULT 'pending',
  counted_by UUID NULL,
  counted_at TIMESTAMP WITH TIME ZONE NULL,
  variance_reason stock_take_variance_reason NULL,
  reviewer_notes TEXT NULL,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_take_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_entries ENABLE ROW LEVEL SECURITY;

-- RLS for stock_take_sessions
CREATE POLICY "Users can view their tenant sessions"
  ON public.stock_take_sessions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Managers can create sessions"
  ON public.stock_take_sessions FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Managers can update sessions"
  ON public.stock_take_sessions FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

-- RLS for stock_take_entries
CREATE POLICY "Users can view entries in their tenant sessions"
  ON public.stock_take_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_take_sessions s
      WHERE s.id = stock_take_entries.session_id
      AND (s.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can create entries"
  ON public.stock_take_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_take_sessions s
      WHERE s.id = stock_take_entries.session_id
      AND s.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can update entries"
  ON public.stock_take_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_take_sessions s
      WHERE s.id = stock_take_entries.session_id
      AND s.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_stock_take_sessions_updated_at
  BEFORE UPDATE ON public.stock_take_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
