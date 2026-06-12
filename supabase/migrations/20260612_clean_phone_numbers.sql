-- =========================================================
-- Migration: Limpeza de telefones para remover formatação
-- Data: 2026-06-12
-- Descrição: Remove caracteres não numéricos dos telefones
--            para garantir consistência e evitar duplicação
-- =========================================================

-- 1. Limpar telefones na tabela clients
UPDATE public.clients
SET tel = regexp_replace(tel, '[^0-9]', '', 'g')
WHERE tel ~ '[^0-9]';

-- 2. Limpar telefones na tabela appointments (se existir coluna tel)
UPDATE public.appointments
SET tel = regexp_replace(tel, '[^0-9]', '', 'g')
WHERE tel IS NOT NULL AND tel ~ '[^0-9]';

-- 3. Remover clientes duplicados mantendo apenas o mais recente
-- Primeiro, identifica duplicatas baseando-se no telefone limpo
WITH duplicates AS (
  SELECT 
    id,
    tel,
    ROW_NUMBER() OVER (
      PARTITION BY tel 
      ORDER BY 
        ultima_visita DESC NULLS LAST, 
        total_gasto DESC, 
        created_at DESC
    ) as rn
  FROM public.clients
  WHERE tel IS NOT NULL AND tel != ''
)
DELETE FROM public.clients
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 4. Atualizar estatísticas das tabelas para otimizar queries
ANALYZE public.clients;
ANALYZE public.appointments;
