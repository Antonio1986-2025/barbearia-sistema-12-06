-- Drop existing permissive policies
DROP POLICY IF EXISTS "appt_anon_ins" ON public.appointments;
DROP POLICY IF EXISTS "appt_anon_sel" ON public.appointments;
DROP POLICY IF EXISTS "appt_auth_all" ON public.appointments;
DROP POLICY IF EXISTS "clients_anon_ins" ON public.clients;
DROP POLICY IF EXISTS "clients_anon_sel" ON public.clients;
DROP POLICY IF EXISTS "clients_auth_all" ON public.clients;
DROP POLICY IF EXISTS "dependents_auth_all" ON public.dependents;
DROP POLICY IF EXISTS "blocks_anon_sel" ON public.blocks;
DROP POLICY IF EXISTS "blocks_auth_all" ON public.blocks;
DROP POLICY IF EXISTS "cash_auth_all" ON public.cash_registers;
DROP POLICY IF EXISTS "cashmov_auth_all" ON public.cash_movements;
DROP POLICY IF EXISTS "tx_auth_all" ON public.transactions;
DROP POLICY IF EXISTS "commands_auth_all" ON public.commands;
DROP POLICY IF EXISTS "cmditems_auth_all" ON public.command_items;
DROP POLICY IF EXISTS "settle_auth_all" ON public.daily_settlements;
DROP POLICY IF EXISTS "advances_auth_all" ON public.advances;
DROP POLICY IF EXISTS "stock_auth_all" ON public.stock_items;
DROP POLICY IF EXISTS "stockmov_auth_all" ON public.stock_movements;

-- RE-CREATE POLICIES WITH PROPER RESTRICTIONS

-- Appointments
CREATE POLICY "Public can book via link" ON public.appointments
  FOR INSERT TO anon WITH CHECK (origem = 'link');
CREATE POLICY "Public can view busy slots" ON public.appointments
  FOR SELECT TO anon USING (true);
CREATE POLICY "Staff can view all appointments" ON public.appointments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Clients
CREATE POLICY "Public can register when booking" ON public.clients
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Staff can view and manage clients" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dependents
CREATE POLICY "Staff can manage dependents" ON public.dependents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Blocks (Agendas)
CREATE POLICY "Public can view blocks" ON public.blocks
  FOR SELECT TO anon USING (true);
CREATE POLICY "Staff can manage blocks" ON public.blocks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Financial (Cash, Transactions, Settlements, Advances)
CREATE POLICY "Admins can manage cash registers" ON public.cash_registers
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can manage movements" ON public.cash_movements
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can manage transactions" ON public.transactions
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can manage settlements" ON public.daily_settlements
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can manage advances" ON public.advances
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Commands
CREATE POLICY "Staff can manage commands" ON public.commands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can manage command items" ON public.command_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock
CREATE POLICY "Admins can manage stock" ON public.stock_items
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can manage stock movements" ON public.stock_movements
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
