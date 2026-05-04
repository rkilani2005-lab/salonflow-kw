-- 1) Bookings: add tenant_id and scope RLS properly
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill from staff, fall back to service
UPDATE public.bookings b
SET tenant_id = COALESCE(
  (SELECT s.tenant_id FROM public.staff s WHERE s.id = b.staff_id),
  (SELECT sv.tenant_id FROM public.services sv WHERE sv.id = b.service_id)
)
WHERE tenant_id IS NULL;

ALTER TABLE public.bookings ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON public.bookings(tenant_id);

DROP POLICY IF EXISTS "Users can view bookings in their tenant" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings in their tenant" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings in their tenant" ON public.bookings;

CREATE POLICY "Users can view bookings in their tenant"
  ON public.bookings FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create bookings in their tenant"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update bookings in their tenant"
  ON public.bookings FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete bookings in their tenant"
  ON public.bookings FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Auto-populate tenant_id from staff/service if not provided
CREATE OR REPLACE FUNCTION public.bookings_set_tenant_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := COALESCE(
      (SELECT s.tenant_id FROM public.staff s WHERE s.id = NEW.staff_id),
      (SELECT sv.tenant_id FROM public.services sv WHERE sv.id = NEW.service_id),
      public.get_user_tenant_id(auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_tenant_id_trg ON public.bookings;
CREATE TRIGGER bookings_set_tenant_id_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_tenant_id();

-- 2) Staff: drop anonymous SELECT policy
DROP POLICY IF EXISTS "Anon can view active staff" ON public.staff;

-- 3) User roles: remove self-assignment of any role
DROP POLICY IF EXISTS "Users can only self-assign basic roles in their tenant" ON public.user_roles;

CREATE POLICY "Owners and managers can assign roles in their tenant"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND role <> 'super_admin'
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- 4) Storage: scope logos bucket policies to tenant folder ({tenant_id}/...)
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

CREATE POLICY "Tenant users can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "Tenant users can update logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "Tenant users can delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

-- 5) generate_po_number / generate_grn_number: validate tenant_id matches caller
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INTEGER;
  user_tenant uuid;
BEGIN
  user_tenant := public.get_user_tenant_id(auth.uid());
  IF user_tenant IS NOT NULL AND NEW.tenant_id <> user_tenant THEN
    RAISE EXCEPTION 'tenant_id mismatch';
  END IF;
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_num FROM purchase_orders WHERE tenant_id = NEW.tenant_id;
  NEW.po_number := 'PO-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_num INTEGER;
  user_tenant uuid;
BEGIN
  user_tenant := public.get_user_tenant_id(auth.uid());
  IF user_tenant IS NOT NULL AND NEW.tenant_id <> user_tenant THEN
    RAISE EXCEPTION 'tenant_id mismatch';
  END IF;
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num FROM goods_receipts WHERE tenant_id = NEW.tenant_id;
  NEW.grn_number := 'GRN-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END; $$;