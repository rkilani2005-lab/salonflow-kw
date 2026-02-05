-- Add DELETE policy for staff table
CREATE POLICY "Users can delete staff in their tenant"
ON public.staff FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()));