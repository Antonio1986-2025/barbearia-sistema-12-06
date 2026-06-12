import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_URL") || Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const DEFAULT_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") || "navalha";

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Buscar chats que não tiveram agendamento nem resposta há mais de 10 minutos
    // Consideramos chats criados nos últimos 60 min, mas sem mensagens novas há 10 min
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: abandonedChats } = await supabase
      .from('ai_chats')
      .select('*, whatsapp_instances(instance_name, ai_brain)')
      .is('last_follow_up_at', null)
      .gt('created_at', oneHourAgo)
      .lt('created_at', tenMinsAgo)
      .order('created_at', { ascending: false });

    if (!abandonedChats || abandonedChats.length === 0) {
      return new Response(JSON.stringify({ status: "no chats to follow up" }), { headers: corsHeaders });
    }

    for (const chat of abandonedChats) {
      const remoteJid = chat.remote_jid;
      const phone = remoteJid.split('@')[0].replace(/\D/g, '');
      
      // Verificar se o cliente agendou nos últimos 20 minutos
      const { data: appointment } = await supabase
        .from('appointments')
        .select('id')
        .ilike('tel', `%${phone}%`)
        .gt('created_at', oneHourAgo)
        .maybeSingle();

      if (!appointment) {
        // Enviar lembrete via IA
        const instanceName = chat.whatsapp_instances?.instance_name || DEFAULT_INSTANCE;
        const customBrain = chat.whatsapp_instances?.ai_brain || "Você é o assistente da Barbearia Status.";
        
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              {
                role: "system",
                content: `${customBrain}
                O cliente iniciou uma conversa mas ainda não finalizou o agendamento pelo link. 
                Envie uma mensagem curta e amigável perguntando se ele teve alguma dúvida ou se gostaria de ajuda para finalizar o agendamento agora. 
                Mencione que temos poucas vagas disponíveis.`
              },
              { role: "user", content: "Lembrete de agendamento pendente." }
            ]
          })
        });

        const aiData = await aiResponse.json();
        const followUpText = aiData.choices?.[0]?.message?.content;

        if (followUpText) {
          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ number: remoteJid, text: followUpText })
          });

          // Marcar como seguido
          await supabase
            .from('ai_chats')
            .update({ last_follow_up_at: new Date().toISOString() })
            .eq('id', chat.id);
        }
      } else {
        // Se agendou, apenas marcamos para não processar novamente
        await supabase
          .from('ai_chats')
          .update({ last_follow_up_at: new Date().toISOString() })
          .eq('id', chat.id);
      }
    }

    return new Response(JSON.stringify({ status: "processed", count: abandonedChats.length }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});