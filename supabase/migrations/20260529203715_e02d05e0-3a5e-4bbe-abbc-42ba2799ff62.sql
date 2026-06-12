-- Habilitar extensões necessárias se não estiverem ativas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Garantir que as tabelas de controle existam
CREATE TABLE IF NOT EXISTS public.ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES public.whatsapp_instances(id),
    remote_jid TEXT NOT NULL,
    message_text TEXT,
    response_text TEXT,
    last_follow_up_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Configurar o cron job para rodar a cada 10 minutos
-- Substituímos o valor da URL dinamicamente via variável de ambiente ou hardcoded se necessário
SELECT cron.schedule('whatsapp-follow-up-cron', '*/10 * * * *', 'SELECT net.http_post(
  url := ''https://tkztzgpryhioilwrhern.supabase.co/functions/v1/whatsapp-follow-up'',
  headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT COALESCE(NULLIF(current_setting(''app.settings.service_role_key'', true), ''''), ''ANON_OR_SERVICE_ROLE_KEY'')))
)');
