ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS ai_brain TEXT;

COMMENT ON COLUMN public.whatsapp_instances.ai_brain IS 'Instruções personalizadas que definem o comportamento e conhecimento do agente de IA.';