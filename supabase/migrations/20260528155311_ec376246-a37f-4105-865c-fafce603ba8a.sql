REVOKE EXECUTE ON FUNCTION public.current_salon_id() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_salon_id() TO authenticated, service_role;