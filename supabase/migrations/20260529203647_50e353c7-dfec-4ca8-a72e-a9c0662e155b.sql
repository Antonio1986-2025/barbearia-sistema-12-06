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
