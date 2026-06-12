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
