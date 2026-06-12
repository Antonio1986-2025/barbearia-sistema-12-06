-- =====================================================================
-- CORREÇÃO: alinhar o check de "origem" da tabela appointments.
-- Rode no SQL Editor do Supabase. Pode rodar TUDO de uma vez.
-- =====================================================================

-- 1) Remove o check antigo (que não aceita 'admin'/'link'/'whatsapp').
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_origem_check;

-- 2) Recria aceitando os valores que o app usa (+ 'manual' por compatibilidade).
--    NOT VALID = passa a valer para novos registros sem validar os antigos.
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_origem_check
  CHECK (origem IN ('admin','link','whatsapp','manual')) NOT VALID;

-- 3) (Opcional, mas recomendado) mesmo alinhamento para o status da comanda.
ALTER TABLE public.commands DROP CONSTRAINT IF EXISTS commands_status_check;
ALTER TABLE public.commands
  ADD CONSTRAINT commands_status_check
  CHECK (status IN ('aberta','paga','finalizada','cancelada')) NOT VALID;
