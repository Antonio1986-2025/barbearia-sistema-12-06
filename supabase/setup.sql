-- =====================================================================
-- Barbearia Status — Script de configuração de um NOVO projeto Supabase
-- =====================================================================
-- Como usar:
--   1. Crie um projeto novo em https://supabase.com
--   2. Abra o SQL Editor do projeto
--   3. Cole TODO este arquivo e clique em "Run"
--   4. Crie o usuario admin em Authentication > Users > Add user
--      (marque Auto Confirm) e depois rode:
--        update public.profiles set tipo = 'admin'
--        where id = (select id from auth.users where email = 'SEU_EMAIL');
--
-- Observacao: as funcoes opcionais de WhatsApp/IA (cron de follow-up)
-- nao estao incluidas aqui; veja o README para ativa-las.
-- =====================================================================


-- ===== 20260527211009_fc29a8da-661f-455f-b863-630a5e50dc44.sql =====


-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- profiles
-- =========================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'barbeiro' CHECK (tipo IN ('admin','barbeiro')),
  prof_id     INTEGER,
  avatar      TEXT,
  cor         TEXT DEFAULT '#c9a045',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND tipo = 'admin');
$$;

CREATE POLICY "perfil_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "perfil_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "perfil_admin_select_all" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "perfil_admin_update_all" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'barbeiro')
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- professionals
-- =========================================================
CREATE TABLE public.professionals (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'Barbeiro',
  cor         TEXT NOT NULL DEFAULT '#c9a045',
  avatar      TEXT NOT NULL DEFAULT 'BB',
  foto_url    TEXT,
  comissao_pct NUMERIC NOT NULL DEFAULT 50 CHECK (comissao_pct BETWEEN 0 AND 100),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT SELECT ON public.professionals TO anon;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof_select_auth" ON public.professionals FOR SELECT TO authenticated USING (true);
CREATE POLICY "prof_select_anon" ON public.professionals FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "prof_insert" ON public.professionals FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "prof_update" ON public.professionals FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "prof_delete" ON public.professionals FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
INSERT INTO public.professionals (id, nome, categoria, cor, avatar, comissao_pct, ativo, ordem) VALUES
  (1, 'Junio',  'Proprietário', '#c9a045', 'JU', 50, true, 1),
  (2, 'Diogo',  'Barbeiro',     '#5a9e6b', 'DI', 50, true, 2),
  (3, 'Felipe', 'Barbeiro',     '#5b8db8', 'FE', 50, true, 3),
  (4, 'Luan',   'Barbeiro',     '#b88a5b', 'LU', 50, true, 4);
SELECT setval('public.professionals_id_seq', 100);

-- =========================================================
-- services
-- =========================================================
CREATE TABLE public.services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  duracao     INTEGER NOT NULL DEFAULT 30 CHECK (duracao > 0),
  preco       NUMERIC NOT NULL DEFAULT 0 CHECK (preco >= 0),
  categoria   TEXT NOT NULL DEFAULT 'Cabelo',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT ON public.services TO anon;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_select_auth" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "svc_select_anon" ON public.services FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "svc_insert" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "svc_update" ON public.services FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "svc_delete" ON public.services FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
INSERT INTO public.services (nome, preco, duracao, categoria, ativo, ordem) VALUES
  ('Corte Masculino',45,30,'Cabelo',true,1),('Corte e Barba',90,50,'Cabelo',true,2),
  ('Barba',45,20,'Cabelo',true,3),('Corte e Meia Barba',60,40,'Cabelo',true,4),
  ('Corte e Sobrancelha',50,30,'Cabelo',true,5),('Corte, Barba e Sobrancelha',100,50,'Cabelo',true,6),
  ('Corte, Meia Barba e Sobrancelha',70,50,'Cabelo',true,7),('Corte Feminino',50,30,'Cabelo',true,8),
  ('Corte a Domicílio',40,60,'Cabelo',true,9),('Corte e Barba a Domicílio',70,60,'Cabelo',true,10),
  ('Corte Lateral',20,30,'Cabelo',true,11),('Corte Militar',22.5,30,'Cabelo',true,12),
  ('Barba e Sobrancelha',50,30,'Cabelo',true,13),('Meia Barba',20,15,'Cabelo',true,14),
  ('Pezinho',10,30,'Cabelo',true,15),('Hidratação Curta',15,30,'Cabelo',true,16),
  ('Hidratação Média',20,30,'Cabelo',true,17),('Hidratação Longa',35,30,'Cabelo',true,18),
  ('Aplicação de Minoxidil',20,30,'Cabelo',true,19),('Pigmentação Barba',15,30,'Cabelo',true,20),
  ('Platinagem',100,60,'Cabelo',true,21),('Relaxamento Capilar',50,30,'Cabelo',true,22),
  ('Tintura',70,30,'Cabelo',true,23),('Tratamento Calvície',20,30,'Cabelo',true,24),
  ('Design de Sobrancelha',10,15,'Barbearia',true,25),('Sobrancelha',10,15,'Estética Facial',true,26);

-- =========================================================
-- settings
-- =========================================================
CREATE TABLE public.settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_barbearia      TEXT NOT NULL DEFAULT 'Barbearia Status',
  logo_url            TEXT,
  horario_inicio      TEXT NOT NULL DEFAULT '07:30',
  horario_fim         TEXT NOT NULL DEFAULT '22:00',
  slot_minutos        INTEGER NOT NULL DEFAULT 30,
  dias_funcionamento  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT ON public.settings TO anon;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_select_anon" ON public.settings FOR SELECT TO anon USING (true);
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "settings_insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.settings (nome_barbearia, horario_inicio, horario_fim) VALUES ('Barbearia Status', '07:30', '22:00');

-- =========================================================
-- clients
-- =========================================================
CREATE TABLE public.clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  tel             TEXT NOT NULL UNIQUE,
  email           TEXT,
  genero          TEXT,
  data_nascimento DATE,
  observacao      TEXT,
  total_gasto     NUMERIC NOT NULL DEFAULT 0,
  visitas         INTEGER NOT NULL DEFAULT 0,
  ultima_visita   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_tel ON public.clients(tel);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT ON public.clients TO anon;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_auth_all" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clients_anon_sel" ON public.clients FOR SELECT TO anon USING (true);
CREATE POLICY "clients_anon_ins" ON public.clients FOR INSERT TO anon WITH CHECK (true);
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

-- =========================================================
-- dependents
-- =========================================================
CREATE TABLE public.dependents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  data_nascimento DATE,
  total_gasto     NUMERIC NOT NULL DEFAULT 0,
  visitas         INTEGER NOT NULL DEFAULT 0,
  ultima_visita   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dependents_titular ON public.dependents(titular_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependents TO authenticated;
GRANT ALL ON public.dependents TO service_role;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dependents_auth_all" ON public.dependents FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.dependents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dependents;

-- =========================================================
-- appointments
-- =========================================================
CREATE TABLE public.appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id         INTEGER NOT NULL REFERENCES public.professionals(id),
  servico_id      UUID REFERENCES public.services(id) ON DELETE SET NULL,
  cliente         TEXT NOT NULL,
  tel             TEXT NOT NULL,
  servico         TEXT NOT NULL,
  data            DATE NOT NULL,
  hora            TEXT NOT NULL,
  duracao         INTEGER NOT NULL DEFAULT 30,
  valor           NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','concluido','cancelado')),
  origem          TEXT NOT NULL DEFAULT 'admin' CHECK (origem IN ('admin','link','whatsapp')),
  titular_id      UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  dependente_nome TEXT,
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_data ON public.appointments(data);
CREATE INDEX idx_appt_prof ON public.appointments(prof_id);
CREATE INDEX idx_appt_titular ON public.appointments(titular_id);
CREATE INDEX idx_appt_status ON public.appointments(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt_auth_all" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "appt_anon_sel" ON public.appointments FOR SELECT TO anon USING (true);
CREATE POLICY "appt_anon_ins" ON public.appointments FOR INSERT TO anon WITH CHECK (origem = 'link');
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- =========================================================
-- blocks
-- =========================================================
CREATE TABLE public.blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id     INTEGER NOT NULL REFERENCES public.professionals(id),
  data        DATE NOT NULL,
  hora        TEXT NOT NULL,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prof_id, data, hora)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT SELECT ON public.blocks TO anon;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_auth_all" ON public.blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blocks_anon_sel" ON public.blocks FOR SELECT TO anon USING (true);
ALTER TABLE public.blocks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;

-- =========================================================
-- cash_registers + cash_movements
-- =========================================================
CREATE TABLE public.cash_registers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data            DATE NOT NULL UNIQUE,
  valor_inicial   NUMERIC NOT NULL DEFAULT 0,
  valor_final     NUMERIC,
  abertura        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechamento      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  responsavel     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_auth_all" ON public.cash_registers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cash_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_id         UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  descricao       TEXT NOT NULL,
  valor           NUMERIC NOT NULL,
  forma_pagamento TEXT,
  hora            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cashmov_cash ON public.cash_movements(cash_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashmov_auth_all" ON public.cash_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- commands + command_items
-- =========================================================
CREATE SEQUENCE public.commands_numero_seq START 1;
CREATE TABLE public.commands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          INTEGER NOT NULL DEFAULT nextval('public.commands_numero_seq'),
  cliente_id      UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','finalizada','cancelada')),
  valor           NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  troco           NUMERIC,
  valor_recebido  NUMERIC,
  abertura        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechamento      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.commands_numero_seq TO authenticated;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commands_auth_all" ON public.commands FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.command_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id  UUID NOT NULL REFERENCES public.commands(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  valor       NUMERIC NOT NULL,
  prof_id     INTEGER REFERENCES public.professionals(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL DEFAULT 'servico' CHECK (tipo IN ('servico','produto'))
);
CREATE INDEX idx_cmditems_cmd ON public.command_items(command_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_items TO authenticated;
GRANT ALL ON public.command_items TO service_role;
ALTER TABLE public.command_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmditems_auth_all" ON public.command_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- transactions
-- =========================================================
CREATE TABLE public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  categoria       TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  valor           NUMERIC NOT NULL,
  forma_pagamento TEXT,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_data ON public.transactions(data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_auth_all" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- advances
-- =========================================================
CREATE TABLE public.advances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id         INTEGER NOT NULL REFERENCES public.professionals(id),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  valor           NUMERIC NOT NULL,
  status          TEXT NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','aprovado','pago','recusado')),
  solicitado_por  TEXT,
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advances TO authenticated;
GRANT ALL ON public.advances TO service_role;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advances_auth_all" ON public.advances FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- daily_settlements
-- =========================================================
CREATE TABLE public.daily_settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id         INTEGER NOT NULL REFERENCES public.professionals(id),
  data            DATE NOT NULL,
  servicos_total  NUMERIC NOT NULL DEFAULT 0,
  comissao        NUMERIC NOT NULL DEFAULT 0,
  consumiveis     NUMERIC NOT NULL DEFAULT 0,
  vales           NUMERIC NOT NULL DEFAULT 0,
  liquido         NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prof_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_settlements TO authenticated;
GRANT ALL ON public.daily_settlements TO service_role;
ALTER TABLE public.daily_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settle_auth_all" ON public.daily_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- stock_items + stock_movements
-- =========================================================
CREATE TABLE public.stock_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'un',
  quantidade  NUMERIC NOT NULL DEFAULT 0,
  minimo      NUMERIC NOT NULL DEFAULT 0,
  custo       NUMERIC NOT NULL DEFAULT 0,
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_auth_all" ON public.stock_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada','saida','consumo','ajuste')),
  quantidade  NUMERIC NOT NULL,
  motivo      TEXT,
  prof_id     INTEGER REFERENCES public.professionals(id) ON DELETE SET NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stockmov_item ON public.stock_movements(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stockmov_auth_all" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.stock_items SET quantidade = quantidade + NEW.quantidade WHERE id = NEW.item_id;
  ELSIF NEW.tipo IN ('saida','consumo') THEN
    UPDATE public.stock_items SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.item_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE public.stock_items SET quantidade = NEW.quantidade WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_stock_quantity
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_quantity();

-- =========================================================
-- Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.slot_disponivel(
  p_prof_id INTEGER, p_data DATE, p_hora TEXT, p_duracao INTEGER, p_excluir UUID DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.prof_id = p_prof_id AND a.data = p_data
      AND a.status <> 'cancelado'
      AND (p_excluir IS NULL OR a.id <> p_excluir)
      AND (
        (a.hora::time, (a.hora::time + (a.duracao || ' minutes')::interval))
        OVERLAPS
        (p_hora::time, (p_hora::time + (p_duracao || ' minutes')::interval))
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE b.prof_id = p_prof_id AND b.data = p_data AND b.hora = p_hora
  );
$$;

CREATE OR REPLACE FUNCTION public.faturamento_periodo(p_inicio DATE, p_fim DATE)
RETURNS TABLE (total_faturado NUMERIC, total_atendimentos INTEGER, ticket_medio NUMERIC, taxa_conclusao NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(CASE WHEN status = 'concluido' THEN valor ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'concluido' THEN 1 END)::INTEGER,
    CASE WHEN COUNT(CASE WHEN status = 'concluido' THEN 1 END) > 0
      THEN SUM(CASE WHEN status = 'concluido' THEN valor ELSE 0 END) /
           COUNT(CASE WHEN status = 'concluido' THEN 1 END)
      ELSE 0 END,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(CASE WHEN status = 'concluido' THEN 1 END)::NUMERIC / COUNT(*) * 100, 1)
      ELSE 0 END
  FROM public.appointments WHERE data BETWEEN p_inicio AND p_fim;
$$;


-- ===== 20260528205224_2b43fa73-7252-4bbc-9292-62be5988c1fd.sql =====

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


-- ===== 20260528205244_232a8f4a-7002-4c6f-ac1e-ebaec04a0f4c.sql =====

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


-- ===== 20260529131317_48be0eaf-f59c-498b-b64d-97817fe72008.sql =====

ALTER TABLE public.commands DROP CONSTRAINT IF EXISTS commands_status_check;
ALTER TABLE public.commands ADD CONSTRAINT commands_status_check CHECK (status = ANY (ARRAY['aberta'::text, 'finalizada'::text, 'cancelada'::text, 'paga'::text]));

-- ===== 20260529135353_692a4c54-d590-4d33-a8b3-7159dec738c0.sql =====

CREATE OR REPLACE FUNCTION public.faturamento_periodo(p_inicio date, p_fim date)
 RETURNS TABLE(total_faturado numeric, total_atendimentos integer, ticket_medio numeric, taxa_conclusao numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_faturado numeric;
  v_total_atendimentos integer;
  v_ticket_medio numeric;
  v_taxa_conclusao numeric;
BEGIN
  -- Faturamento total vem da tabela de transações (entradas)
  SELECT COALESCE(SUM(valor), 0) INTO v_total_faturado
  FROM public.transactions 
  WHERE tipo = 'entrada' AND data BETWEEN p_inicio AND p_fim;

  -- Total de atendimentos baseia-se em comandas pagas
  SELECT COUNT(*)::INTEGER INTO v_total_atendimentos
  FROM public.commands
  WHERE status = 'paga' AND fechamento::date BETWEEN p_inicio AND p_fim;

  -- Se não houver comandas, tenta contar appointments concluidos (suporte a dados legados)
  IF v_total_atendimentos = 0 THEN
    SELECT COUNT(*)::INTEGER INTO v_total_atendimentos
    FROM public.appointments
    WHERE status = 'concluido' AND data BETWEEN p_inicio AND p_fim;
  END IF;

  -- Cálculo do Ticket Médio
  IF v_total_atendimentos > 0 THEN
    v_ticket_medio := v_total_faturado / v_total_atendimentos;
  ELSE
    v_ticket_medio := 0;
  END IF;

  -- Taxa de conclusão baseada nos agendamentos
  SELECT
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(CASE WHEN status IN ('concluido', 'paga', 'pago') THEN 1 END)::NUMERIC / COUNT(*) * 100, 1)
      ELSE 100 END INTO v_taxa_conclusao
  FROM public.appointments WHERE data BETWEEN p_inicio AND p_fim;
  
  -- Se houver faturamento mas nenhuma agenda concluída (uso exclusivo de comandas), ajusta a taxa
  IF v_taxa_conclusao = 0 AND v_total_faturado > 0 THEN
    v_taxa_conclusao := 100;
  END IF;

  RETURN QUERY SELECT 
    v_total_faturado::numeric, 
    v_total_atendimentos::integer, 
    v_ticket_medio::numeric, 
    v_taxa_conclusao::numeric;
END;
$function$;

-- ===== 20260529181100_9588aeba-45fc-46ab-8766-dc096d74eb5e.sql =====

-- Tabela para gerenciar instâncias da Evolution API
CREATE TABLE public.whatsapp_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    instance_name TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view instances" ON public.whatsapp_instances FOR SELECT USING (true);

-- Tabela para log de mensagens (opcional, mas recomendado para contexto da IA)
CREATE TABLE public.whatsapp_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID REFERENCES public.whatsapp_instances(id),
    remote_jid TEXT NOT NULL,
    from_me BOOLEAN DEFAULT false,
    content TEXT,
    message_type TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages" ON public.whatsapp_messages FOR SELECT USING (true);

-- Tabela de agendamentos (se ainda não existir)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    service_type TEXT,
    status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
    source TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Users can insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update appointments" ON public.appointments FOR UPDATE USING (true);


-- ===== 20260529184549_2c45f22c-8a34-468c-97e7-5d62926a893c.sql =====

ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS ai_brain TEXT;

COMMENT ON COLUMN public.whatsapp_instances.ai_brain IS 'Instruções personalizadas que definem o comportamento e conhecimento do agente de IA.';

-- ===== 20260529190907_e5bfca5c-5f41-4ddc-b735-6684d7e1aea7.sql =====

-- Tabela para logar as conversas da IA
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  message_text TEXT,
  response_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT ON public.ai_chats TO authenticated;
GRANT ALL ON public.ai_chats TO service_role;

-- RLS
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

-- Política
CREATE POLICY "Admins can view all chats" ON public.ai_chats
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (tipo = 'admin' OR tipo = 'master')));

-- View de Conversão (usando appointments.tel)
CREATE OR REPLACE VIEW public.ai_conversion_stats AS
WITH unique_chats AS (
  SELECT 
    DISTINCT ON (remote_jid, date_trunc('day', created_at)) 
    remote_jid, 
    created_at::date as chat_date
  FROM public.ai_chats
)
SELECT 
  uc.chat_date,
  count(uc.remote_jid) as total_leads,
  count(a.id) as converted_appointments
FROM unique_chats uc
LEFT JOIN public.appointments a ON 
  (replace(replace(replace(replace(a.tel, '(', ''), ')', ''), '-', ''), ' ', '') = split_part(uc.remote_jid, '@', 1)
   OR '55' || replace(replace(replace(replace(a.tel, '(', ''), ')', ''), '-', ''), ' ', '') = split_part(uc.remote_jid, '@', 1))
  AND a.created_at::date >= uc.chat_date
  AND a.created_at::date <= (uc.chat_date + interval '25 days')
GROUP BY uc.chat_date;

GRANT SELECT ON public.ai_conversion_stats TO authenticated;
GRANT SELECT ON public.ai_conversion_stats TO service_role;


-- ===== 20260529203647_50e353c7-dfec-4ca8-a72e-a9c0662e155b.sql =====

-- Adicionar campo para controle de follow-up na tabela ai_chats
ALTER TABLE public.ai_chats ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP WITH TIME ZONE;

-- Função para o Agent lidar com novos agendamentos (webhook-like trigger)
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_instance_id UUID;
  v_instance_name TEXT;
  v_remote_jid TEXT;
BEGIN
  -- Tenta encontrar o remote_jid baseado no telefone do agendamento
  -- Removendo caracteres não numéricos e garantindo o sufixo @s.whatsapp.net
  v_remote_jid := regexp_replace(NEW.tel, '[^0-9]', '', 'g') || '@s.whatsapp.net';
  
  -- Pega a primeira instância ativa (ou a padrão)
  SELECT id, instance_name INTO v_instance_id, v_instance_name 
  FROM public.whatsapp_instances 
  WHERE is_active = true 
  LIMIT 1;

  -- Dispara um evento para a Edge Function
  -- Como não podemos chamar HTTP diretamente do PG de forma fácil sem extensões complexas,
  -- vamos inserir uma mensagem especial na ai_chats que a Edge Function pode "perceber" se for polling,
  -- ou melhor: vamos apenas confiar que a Edge Function será chamada pelo Webhook de Agendamento se configurado.
  -- Mas o usuário quer que o AGENTE mande o resumo.
  
  -- Vamos registrar que houve um agendamento para este JID para que a IA possa confirmar
  INSERT INTO public.ai_chats (instance_id, remote_jid, message_text, response_text)
  VALUES (v_instance_id, v_remote_jid, 'SYSTEM_EVENT_APPOINTMENT_CREATED', 'Resumo de agendamento: ' || NEW.servico || ' em ' || NEW.data || ' às ' || NEW.hora);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para novos agendamentos
DROP TRIGGER IF EXISTS on_new_appointment ON public.appointments;
CREATE TRIGGER on_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_appointment();

-- Grant permissions
GRANT ALL ON public.ai_chats TO service_role;
GRANT ALL ON public.ai_chats TO authenticated;

