
-- =============================================
-- Inventory & Procurement System - Phase 1 Schema
-- =============================================

-- Enums
CREATE TYPE public.product_type AS ENUM ('professional', 'retail', 'both');
CREATE TYPE public.po_status AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'cancelled');
CREATE TYPE public.inventory_transaction_type AS ENUM ('purchase_receipt', 'service_consumption', 'retail_sale', 'adjustment', 'wastage', 'return');
CREATE TYPE public.vendor_invoice_status AS ENUM ('pending', 'partially_paid', 'paid', 'overdue', 'disputed');
CREATE TYPE public.vendor_payment_method AS ENUM ('cash', 'bank_transfer', 'cheque', 'knet');
CREATE TYPE public.po_sent_via AS ENUM ('email', 'whatsapp', 'manual');

-- 1. product_categories
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  parent_id UUID REFERENCES public.product_categories(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant categories" ON public.product_categories
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can manage their tenant categories" ON public.product_categories
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can update their tenant categories" ON public.product_categories
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can delete their tenant categories" ON public.product_categories
  FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- 2. products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  category_id UUID REFERENCES public.product_categories(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  product_type public.product_type NOT NULL DEFAULT 'professional',
  purchase_unit TEXT DEFAULT 'Unit',
  purchase_unit_quantity NUMERIC DEFAULT 1,
  usage_unit TEXT DEFAULT 'Unit',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  retail_price NUMERIC DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 20,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant products" ON public.products
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can insert products" ON public.products
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can update products" ON public.products
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));

-- 3. suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  address TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant suppliers" ON public.suppliers
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can update suppliers" ON public.suppliers
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));

-- 4. product_suppliers
CREATE TABLE public.product_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  agreed_cost NUMERIC DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  is_preferred BOOLEAN DEFAULT false,
  UNIQUE(product_id, supplier_id)
);
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product suppliers via product tenant" ON public.product_suppliers
  FOR SELECT USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND (p.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can manage product suppliers" ON public.product_suppliers
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND p.tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk'))));
CREATE POLICY "Users can update product suppliers" ON public.product_suppliers
  FOR UPDATE USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND p.tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk'))));
CREATE POLICY "Users can delete product suppliers" ON public.product_suppliers
  FOR DELETE USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND p.tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))));

-- 5. service_recipes
CREATE TABLE public.service_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_per_service NUMERIC NOT NULL DEFAULT 1,
  UNIQUE(service_id, product_id)
);
ALTER TABLE public.service_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant recipes" ON public.service_recipes
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can manage recipes" ON public.service_recipes
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can update recipes" ON public.service_recipes
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can delete recipes" ON public.service_recipes
  FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- 6. purchase_orders
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  po_number TEXT NOT NULL,
  status public.po_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  payment_terms TEXT,
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  sent_via public.po_sent_via,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant POs" ON public.purchase_orders
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create POs" ON public.purchase_orders
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));
CREATE POLICY "Users can update POs" ON public.purchase_orders
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));

-- Auto-generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM purchase_orders
    WHERE tenant_id = NEW.tenant_id;
  NEW.po_number := 'PO-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_po_number();

-- 7. purchase_order_items
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_ordered NUMERIC NOT NULL DEFAULT 0,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO items via PO tenant" ON public.purchase_order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id AND (po.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can manage PO items" ON public.purchase_order_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id AND po.tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update PO items" ON public.purchase_order_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id AND po.tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can delete PO items" ON public.purchase_order_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id AND po.tenant_id = get_user_tenant_id(auth.uid())));

-- 8. goods_receipts
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  grn_number TEXT NOT NULL,
  received_by UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant GRs" ON public.goods_receipts
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create GRs" ON public.goods_receipts
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));

-- Auto-generate GRN number
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM goods_receipts
    WHERE tenant_id = NEW.tenant_id;
  NEW.grn_number := 'GRN-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_grn_number
  BEFORE INSERT ON public.goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_grn_number();

-- 9. goods_receipt_items
CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  po_item_id UUID REFERENCES public.purchase_order_items(id),
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE
);
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view GR items via GR tenant" ON public.goods_receipt_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.id = goods_receipt_items.goods_receipt_id AND (gr.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))));
CREATE POLICY "Users can create GR items" ON public.goods_receipt_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.id = goods_receipt_items.goods_receipt_id AND gr.tenant_id = get_user_tenant_id(auth.uid())));

-- 10. vendor_invoices
CREATE TABLE public.vendor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KWD',
  status public.vendor_invoice_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant invoices" ON public.vendor_invoices
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create invoices" ON public.vendor_invoices
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk') OR has_role(auth.uid(), 'accountant')));
CREATE POLICY "Users can update invoices" ON public.vendor_invoices
  FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- 11. vendor_payments
CREATE TABLE public.vendor_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  vendor_invoice_id UUID NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method public.vendor_payment_method NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant payments" ON public.vendor_payments
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create payments" ON public.vendor_payments
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'accountant')));

-- 12. inventory_transactions
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  transaction_type public.inventory_transaction_type NOT NULL,
  quantity_change NUMERIC NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant transactions" ON public.inventory_transactions
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create transactions" ON public.inventory_transactions
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'inventory_clerk')));

-- Indexes for performance
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_sku ON public.products(tenant_id, sku);
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(tenant_id, status);
CREATE INDEX idx_inventory_transactions_product ON public.inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_tenant ON public.inventory_transactions(tenant_id);
CREATE INDEX idx_vendor_invoices_tenant ON public.vendor_invoices(tenant_id);
CREATE INDEX idx_vendor_invoices_status ON public.vendor_invoices(tenant_id, status);

-- Updated_at triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendor_invoices_updated_at BEFORE UPDATE ON public.vendor_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
