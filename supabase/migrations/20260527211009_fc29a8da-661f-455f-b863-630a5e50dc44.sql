
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
