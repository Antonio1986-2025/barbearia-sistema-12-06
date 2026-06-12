import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    // Aceita tanto EVOLUTION_URL quanto EVOLUTION_API_URL (compatibilidade).
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_URL") || Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const DEFAULT_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") || "navalha";
    const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bookingLink = Deno.env.get("PUBLIC_BOOKING_URL") || "http://localhost:5173/agendar";

    // Validação de configuração — informa exatamente o que falta (sem expor valores).
    const missing = [
      ...(!OPENAI_API_KEY ? ["OPENAI_API_KEY"] : []),
      ...(!EVOLUTION_API_URL ? ["EVOLUTION_URL"] : []),
      ...(!EVOLUTION_API_KEY ? ["EVOLUTION_API_KEY"] : []),
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Configuração ausente: ${missing.join(", ")}` }),
        { status: 500, headers: corsHeaders },
      );
    }

    // Proteção opcional do webhook: se WEBHOOK_SECRET estiver definido, exige
    // o mesmo valor no header "x-webhook-secret" ou no parâmetro ?secret=.
    if (WEBHOOK_SECRET) {
      const url = new URL(req.url);
      const provided = req.headers.get("x-webhook-secret") || url.searchParams.get("secret");
      if (provided !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const data = body.data || body;
    const remoteJid = data.key?.remoteJid;

    if (!remoteJid || remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ status: "ignored" }), { status: 200, headers: corsHeaders });
    }

    const instanceName = body.instance || DEFAULT_INSTANCE;

    // 0. Enviar status de "digitando..." para o WhatsApp
    try {
      await fetch(`${EVOLUTION_API_URL}/chat/sendPresence/${instanceName}`, {
        method: "POST",
        headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ number: remoteJid, presence: "composing", delay: 1200 })
      });
    } catch (e) {
      console.error("Error sending presence:", e);
    }

    let messageText = data.message?.conversation || 
                      data.message?.extendedTextMessage?.text ||
                      data.content?.text || data.text || "";

    const messageType = data.messageType || (data.message ? Object.keys(data.message)[0] : "text");
    let mediaUrl = "";
    let base64Media = "";

    // 1. Lidar com Mídia (Imagem ou Áudio)
    if (messageType === 'imageMessage' || messageType === 'audioMessage') {
      console.log(`Processing media message of type: ${messageType}`);
      
      // Tentar extrair o conteúdo da mensagem de diferentes níveis possíveis
      // A Evolution v2 pode enviar os dados de várias formas. Vamos ser mais robustos.
      // O erro 'TypeError: Cannot read properties of undefined (reading 'ephemeralMessage')' 
      // geralmente ocorre quando data.message é nulo ou a estrutura é diferente do esperado.
      
      let messageContent = data.message;
      
      // Se data.message for undefined, tentamos data diretamente (webhook da Evolution pode variar)
      if (!messageContent) {
        messageContent = data;
      }

      // Navegação segura para extrair o conteúdo real da mensagem
      if (messageContent?.ephemeralMessage?.message) {
        messageContent = messageContent.ephemeralMessage.message;
      } else if (messageContent?.viewOnceMessageV2?.message) {
        messageContent = messageContent.viewOnceMessageV2.message;
      } else if (messageContent?.viewOnceMessage?.message) {
        messageContent = messageContent.viewOnceMessage.message;
      } else if (messageContent?.documentWithCaptionMessage?.message) {
        messageContent = messageContent.documentWithCaptionMessage.message;
      }
      
      console.log("Extracted message content for media fetch:", JSON.stringify(messageContent));

      // A Evolution API v2 espera o objeto da mensagem que contém as propriedades de mídia (url, directPath, etc)
      // Ajuste: A API às vezes espera apenas o objeto da mensagem real, não o wrapper
      const mediaObject = messageContent?.[messageType] ? messageContent : { [messageType]: messageContent };
      
      console.log(`Fetching media from Evolution. Message type: ${messageType}`);

      const mediaResponse = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
        method: "POST",
        headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: mediaObject,
          convertToMp3: messageType === 'audioMessage'
        })
      });

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.error(`Evolution API error (${mediaResponse.status}):`, errorText);
      } else {
        const mediaData = await mediaResponse.json();
        // A API da Evolution v2 costuma retornar { base64: "..." }
        base64Media = mediaData?.base64 || mediaData?.data?.base64 || mediaData;
        if (typeof base64Media === 'object' && base64Media.base64) base64Media = base64Media.base64;
      }

      if (messageType === 'audioMessage' && base64Media) {
        console.log("Transcribing audio...");
        try {
          const binaryString = atob(base64Media);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "audio/mp3" }); // Agora garantimos MP3 vindo da Evolution
          
          const formData = new FormData();
          formData.append("file", blob, "audio.mp3");
          formData.append("model", "whisper-1");

          const transcriptionRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
            body: formData
          });

          if (!transcriptionRes.ok) {
            const transError = await transcriptionRes.text();
            console.error("Whisper error:", transError);
          } else {
            const transcriptionData = await transcriptionRes.json();
            messageText = transcriptionData.text || "";
            console.log("Transcription successful:", messageText);
          }
        } catch (e) {
          console.error("Error processing audio binary:", e);
          // Enviar mensagem de erro amigável se o áudio falhar
          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ 
              number: remoteJid, 
              text: "Desculpe, não consegui processar seu áudio agora. 😕 Pode tentar enviar novamente ou digitar sua mensagem?" 
            })
          });
        }
      } else if (messageType === 'audioMessage' && !base64Media) {
        // Caso a API da Evolution não retorne o base64
        await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            number: remoteJid, 
            text: "Ops! Tive um problema ao baixar seu áudio. Pode mandar de novo, por favor? 🙏" 
          })
        });
      }
    }

    if (!messageText && !base64Media && !(data.key?.fromMe && messageText === "SYSTEM_EVENT_APPOINTMENT_CREATED")) {
      return new Response(JSON.stringify({ status: "ignored" }), { status: 200, headers: corsHeaders });
    }

    // Se for um evento de agendamento, gerar resumo
    if (messageText.startsWith("SYSTEM_EVENT_APPOINTMENT_CREATED")) {
      const summaryText = messageText.replace("SYSTEM_EVENT_APPOINTMENT_CREATED", "").trim();
      
      const { data: instData } = await supabase
        .from("whatsapp_instances")
        .select("ai_brain")
        .eq("instance_name", instanceName)
        .maybeSingle();

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
              content: `${instData?.ai_brain}
              O cliente acabou de confirmar um agendamento. 
              Gere uma mensagem de agradecimento e um resumo amigável com estes dados: ${summaryText}.
              Confirme que está tudo certo e que o esperamos na Barbearia Status.`
            }
          ]
        })
      });

      const aiData = await aiResponse.json();
      const responseText = aiData.choices?.[0]?.message?.content;

      if (responseText) {
        await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ number: remoteJid, text: responseText.replace(bookingLink, "").trim() })
        });

        if (responseText.includes(bookingLink)) {
          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ number: remoteJid, text: bookingLink })
          });
        }
      }
      return new Response(JSON.stringify({ status: "summary_sent" }), { status: 200, headers: corsHeaders });
    }

    // 2. Buscar o 'Cérebro' configurado para esta instância
    const { data: instData } = await supabase
      .from("whatsapp_instances")
      .select("id, ai_brain")
      .eq("instance_name", instanceName)
      .maybeSingle();

    const customBrain = instData?.ai_brain || "Você é o assistente virtual da Barbearia Status. Ajude com dúvidas e agendamentos.";

    // 3. Buscar histórico recente da conversa (Memória de Chat)
    const { data: history } = await supabase
      .from("ai_chats")
      .select("message_text, response_text")
      .eq("remote_jid", remoteJid)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatHistoryContext = (history ?? [])
      .filter((h) => h.message_text && h.response_text && !String(h.message_text).startsWith("SYSTEM_EVENT"))
      .reverse()
      .map((h) => [
        { role: "user", content: h.message_text },
        { role: "assistant", content: h.response_text },
      ]).flat();

    // 4. Buscar informações do cliente e últimos agendamentos (Memória de Perfil)
    const phoneNumber = remoteJid.split('@')[0];
    const { data: clientInfo } = await supabase
      .from("clients")
      .select("nome, observacao, visitas, ultima_visita")
      .eq("tel", phoneNumber)
      .maybeSingle();

    const { data: recentAppointments } = await supabase
      .from("appointments")
      .select("data, hora, servico, status")
      .eq("tel", phoneNumber)
      .order("data", { ascending: false })
      .limit(3);

    let clientContext = "";
    if (clientInfo) {
      clientContext += `\nINFORMAÇÕES DO CLIENTE:\n- Nome: ${clientInfo.nome}\n- Total de Visitas: ${clientInfo.visitas}\n- Última Visita: ${clientInfo.ultima_visita || 'Nenhuma'}\n- Observações: ${clientInfo.observacao || 'Nenhuma'}`;
    }
    
    if (recentAppointments && recentAppointments.length > 0) {
      clientContext += `\nÚLTIMOS AGENDAMENTOS:\n` + recentAppointments.map(a => `- ${a.data} às ${a.hora}: ${a.servico} (${a.status})`).join('\n');
    }

    // 5. Preparar conteúdo para OpenAI (suporte a visão se for imagem)
    let userMessageContent: any = messageText;
    if (messageType === 'imageMessage' && base64Media) {
      userMessageContent = [
        { type: "text", text: messageText || "O que tem nesta imagem?" },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Media}` } }
      ];
    }

    // 6. Agente autônomo com function calling: consulta e AGENDA diretamente.
    const gerarSlots = (inicio: string, fim: string, slotMin: number): string[] => {
      const [hi, mi] = inicio.split(":").map(Number);
      const [hf, mf] = fim.split(":").map(Number);
      const out: string[] = [];
      for (let t = hi * 60 + mi; t < hf * 60 + mf; t += slotMin) {
        out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
      }
      return out;
    };

    // Data/hora atuais no fuso de São Paulo.
    const hojeISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const agoraHM = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    });

    const tools = [
      {
        type: "function",
        function: {
          name: "listar_servicos",
          description: "Lista os serviços ativos da barbearia (id, nome, preço, duração em minutos).",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "listar_barbeiros",
          description: "Lista os barbeiros ativos (id e nome).",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "consultar_horarios",
          description: "Retorna os horários realmente disponíveis de um barbeiro numa data.",
          parameters: {
            type: "object",
            properties: {
              prof_id: { type: "integer", description: "ID do barbeiro" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
            },
            required: ["prof_id", "data"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "criar_agendamento",
          description: "Cria o agendamento no sistema. Use somente após confirmar nome, barbeiro, serviço, data e horário com o cliente.",
          parameters: {
            type: "object",
            properties: {
              nome: { type: "string", description: "Nome do cliente" },
              prof_id: { type: "integer" },
              servico_id: { type: "string", description: "UUID do serviço" },
              data: { type: "string", description: "YYYY-MM-DD" },
              hora: { type: "string", description: "HH:MM" },
              dependente_nome: { type: "string", description: "Nome de quem será atendido, se for outra pessoa (opcional)" },
            },
            required: ["nome", "prof_id", "servico_id", "data", "hora"],
            additionalProperties: false,
          },
        },
      },
    ];

    const executarFerramenta = async (fnName: string, args: any): Promise<any> => {
      try {
        if (fnName === "listar_servicos") {
          const { data } = await supabase.from("services")
            .select("id, nome, preco, duracao, categoria").eq("ativo", true).order("ordem");
          return data ?? [];
        }
        if (fnName === "listar_barbeiros") {
          const { data } = await supabase.from("professionals")
            .select("id, nome, categoria").eq("ativo", true).order("ordem");
          return data ?? [];
        }
        if (fnName === "consultar_horarios") {
          const { data: cfg } = await supabase.from("settings")
            .select("horario_inicio, horario_fim, slot_minutos").maybeSingle();
          if (!cfg) return { erro: "Configuração de horários não encontrada" };
          const todos = gerarSlots(cfg.horario_inicio, cfg.horario_fim, cfg.slot_minutos);
          const { data: ocup } = await supabase.from("appointments")
            .select("hora").eq("prof_id", args.prof_id).eq("data", args.data).neq("status", "cancelado");
          const ocupados = new Set((ocup ?? []).map((r: any) => String(r.hora).slice(0, 5)));
          const disponiveis = todos.filter((h) => {
            if (ocupados.has(h)) return false;
            if (args.data === hojeISO && h <= agoraHM) return false;
            return true;
          });
          return { data: args.data, disponiveis };
        }
        if (fnName === "criar_agendamento") {
          const { data: svc } = await supabase.from("services")
            .select("id, nome, preco, duracao").eq("id", args.servico_id).maybeSingle();
          if (!svc) return { erro: "Serviço não encontrado" };

          // Valida disponibilidade real (considera duração e bloqueios).
          const { data: livre, error: rpcErr } = await supabase.rpc("slot_disponivel", {
            p_prof_id: args.prof_id, p_data: args.data, p_hora: args.hora, p_duracao: svc.duracao,
          });
          if (rpcErr) return { erro: rpcErr.message };
          if (livre === false) return { erro: "Horário indisponível. Ofereça outro horário ao cliente." };

          const clienteFinal = args.dependente_nome
            ? `${args.nome} · ${args.dependente_nome}` : args.nome;

          // Cadastra o cliente se ainda não existir (dedupe pelo telefone do WhatsApp).
          const { data: existing } = await supabase.from("clients")
            .select("id").eq("tel", phoneNumber).maybeSingle();
          if (!existing) {
            await supabase.from("clients").insert({ nome: args.nome, tel: phoneNumber, visitas: 0, total_gasto: 0 });
          }

          const { data: appt, error: apptErr } = await supabase.from("appointments").insert({
            prof_id: args.prof_id, servico_id: svc.id, servico: svc.nome,
            cliente: clienteFinal, tel: phoneNumber,
            data: args.data, hora: args.hora, duracao: svc.duracao, valor: svc.preco,
            dependente_nome: args.dependente_nome ?? null,
            status: "agendado", origem: "whatsapp",
          }).select().single();
          if (apptErr) return { erro: apptErr.message };

          // Abre comanda automaticamente com o serviço (mesmo fluxo do app).
          const { data: lastCmd } = await supabase.from("commands")
            .select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
          const nextNum = (lastCmd?.numero || 0) + 1;
          const { data: cmd } = await supabase.from("commands").insert({
            numero: nextNum, cliente_nome: clienteFinal, status: "aberta",
            abertura: new Date().toISOString(), valor: Number(svc.preco),
          }).select().single();
          if (cmd) {
            await supabase.from("command_items").insert({
              command_id: cmd.id, descricao: svc.nome, valor: Number(svc.preco),
              prof_id: args.prof_id, tipo: "servico",
            });
          }
          return { ok: true, agendamento_id: appt?.id, resumo: `${svc.nome} em ${args.data} às ${args.hora}` };
        }
        return { erro: "Ferramenta desconhecida" };
      } catch (e) {
        return { erro: (e as Error).message };
      }
    };

    const messages: any[] = [
      {
        role: "system",
        content: `${customBrain}

DIRETRIZES DE EXECUÇÃO:
- Você é um atendente que AGENDA diretamente, como uma pessoa de verdade. NUNCA envie links.
- Data de hoje: ${hojeISO} (fuso America/Sao_Paulo). Converta "hoje", "amanhã", "sexta", etc. para datas no formato YYYY-MM-DD.
- Use as ferramentas para listar serviços/barbeiros e consultar horários REAIS antes de oferecer opções. Nunca invente preços, horários ou disponibilidade.
- Antes de criar o agendamento, confirme com o cliente: nome, barbeiro, serviço, data e horário.
- O telefone do cliente já é conhecido (é o WhatsApp dele); não peça o número.
- Para concluir, chame a ferramenta criar_agendamento e, em seguida, confirme de forma amigável o que ficou marcado.
- Se o horário estiver indisponível, ofereça alternativas próximas.
- Seja conciso e use emojis com moderação (✂️ 🪒 📅).
${clientContext}`,
      },
      ...chatHistoryContext,
      { role: "user", content: userMessageContent },
    ];

    let responseText = "";
    for (let iter = 0; iter < 6; iter++) {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: OPENAI_MODEL, messages, tools, tool_choice: "auto" }),
      });
      const aiData = await aiResponse.json();
      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
          const result = await executarFerramenta(tc.function.name, args);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue; // deixa o modelo processar os resultados das ferramentas
      }

      responseText = msg.content || "";
      break;
    }

    if (responseText) {
      if (instData?.id) {
        await supabase.from("ai_chats").insert({
          instance_id: instData.id,
          remote_jid: remoteJid,
          message_text: messageText || (messageType === 'imageMessage' ? "[Imagem enviada]" : "[Mídia]"),
          response_text: responseText,
        });
      }

      await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "apikey": EVOLUTION_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ number: remoteJid, text: responseText }),
      });
    }

    return new Response(JSON.stringify({ status: "success" }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});