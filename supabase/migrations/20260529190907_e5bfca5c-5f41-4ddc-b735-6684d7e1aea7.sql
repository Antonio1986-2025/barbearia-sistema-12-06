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
