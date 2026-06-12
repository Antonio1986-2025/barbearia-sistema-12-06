-- Revoke execute on is_admin from public
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- Refine Appointments
DROP POLICY IF EXISTS "Staff can manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can manage appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Refine Clients
DROP POLICY IF EXISTS "Staff can view and manage clients" ON public.clients;
CREATE POLICY "Staff can view and manage clients" ON public.clients
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Refine Dependents
DROP POLICY IF EXISTS "Staff can manage dependents" ON public.dependents;
CREATE POLICY "Staff can manage dependents" ON public.dependents
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Refine Blocks
DROP POLICY IF EXISTS "Staff can manage blocks" ON public.blocks;
CREATE POLICY "Staff can manage blocks" ON public.blocks
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
