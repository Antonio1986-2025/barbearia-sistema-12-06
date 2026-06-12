/**
 * Servidor do Agente de IA para WhatsApp
 * Recebe webhooks da Evolution API e processa mensagens
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import { readFileSync } from 'fs';

// Carregar .env (opcional - em produção usa variáveis do ambiente)
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        value = value.replace(/^["']|["']$/g, '');
        env[key] = value;
        process.env[key] = value;
      }
    });
    
    console.log('✅ Arquivo .env carregado');
    return env;
  } catch (error) {
    // Em produção, não precisa do .env (variáveis vêm do ambiente)
    if (process.env.NODE_ENV === 'production') {
      console.log('ℹ️ Rodando em produção - usando variáveis de ambiente');
    } else {
      console.warn('⚠️ Arquivo .env não encontrado:', error.message);
    }
    return {};
  }
}

loadEnv();

// Configurações
const PORT = process.env.PORT || process.env.AI_PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || process.env.EVOLUTION_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

// Validar configurações
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase não configurado no .env');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OpenAI API Key não configurada no .env');
  process.exit(1);
}

if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
  console.error('❌ Evolution API não configurada no .env');
  process.exit(1);
}

// Clientes
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Armazenamento de conversas (em memória)
const conversations = new Map();

// Limpar conversas antigas a cada hora
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [phone, conv] of conversations.entries()) {
    if (now - conv.lastUpdate > ONE_HOUR) {
      conversations.delete(phone);
      console.log(`🧹 Conversa de ${phone} expirou e foi limpa`);
    }
  }
}, 60 * 60 * 1000);

// Prompt do sistema
const SYSTEM_PROMPT = `Você é um assistente virtual da Barbearia Status em Coxim, MS.
Sua função é ajudar os clientes a agendar horários de forma natural e amigável via WhatsApp.

INFORMAÇÕES DA BARBEARIA:
- Nome: Barbearia Status
- Localização: Coxim, MS
- Desde: 1991
- Especialidade: Cortes masculinos, barbas e acabamentos profissionais

SEU COMPORTAMENTO:
- Seja amigável, profissional e solícito
- Use linguagem informal mas respeitosa (como um atendente real)
- Seja breve - mensagens curtas funcionam melhor no WhatsApp
- Use emojis moderadamente para tornar a conversa mais agradável
- Chame o cliente pelo nome quando souber

FLUXO DE AGENDAMENTO:
1. Cumprimente e pergunte como pode ajudar
2. Capture o nome completo do cliente
3. Pergunte para quem é o serviço (ele, filho, amigo)
4. Se for outra pessoa, pegue o nome dela
5. Mostre os barbeiros disponíveis (numere as opções)
6. Aguarde escolha do barbeiro
7. Mostre os serviços com preços (numere as opções)
8. Aguarde escolha do serviço
9. Pergunte qual data prefere (próximos 7 dias úteis)
10. Mostre horários disponíveis na data escolhida
11. Aguarde escolha do horário
12. CONFIRME todos os dados antes de finalizar
13. Após confirmação do cliente, responda: CONFIRMAR_AGENDAMENTO

REGRAS IMPORTANTES:
- NÃO invente informações - use apenas dados fornecidos
- NÃO finalize sem confirmação explícita do cliente
- Se não entender, peça clarificação
- Uma pergunta por vez - não sobrecarregue o cliente
- Seja paciente se o cliente demorar para responder

EXEMPLO DE FLUXO:
Cliente: "Oi, quero agendar"
Você: "Olá! Seja bem-vindo à Barbearia Status! 😊 Para começar, qual é o seu nome completo?"
Cliente: "João Silva"
Você: "Prazer, João! O corte é para você mesmo?"
...e assim por diante

Quando o cliente confirmar TODOS os dados, responda APENAS: CONFIRMAR_AGENDAMENTO`;

/**
 * Envia mensagem via WhatsApp
 */
async function sendWhatsApp(phone, message) {
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: phone,
        text: message
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Mensagem enviada para ${phone}`);
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca dados do Supabase
 */
async function buscarDados() {
  const [prosResult, svcsResult, settingsResult] = await Promise.all([
    supabase.from('professionals').select('id, nome, categoria').eq('ativo', true).order('ordem'),
    supabase.from('services').select('id, nome, duracao, preco').eq('ativo', true).order('ordem'),
    supabase.from('settings').select('*').maybeSingle()
  ]);

  return {
    professionals: prosResult.data || [],
    services: svcsResult.data || [],
    settings: settingsResult.data
  };
}

/**
 * Gera slots de horários
 */
function generateSlots(inicio, fim, intervalo) {
  const slots = [];
  const [hI, mI] = inicio.split(':').map(Number);
  const [hF, mF] = fim.split(':').map(Number);
  
  let current = hI * 60 + mI;
  const end = hF * 60 + mF;
  
  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += intervalo;
  }
  
  return slots;
}

/**
 * Busca horários ocupados
 */
async function buscarOcupados(profId, data) {
  const { data: result } = await supabase
    .from('appointments')
    .select('hora')
    .eq('prof_id', profId)
    .eq('data', data)
    .neq('status', 'cancelado');

  return (result || []).map(r => r.hora.slice(0, 5));
}

/**
 * Cria agendamento
 */
async function criarAgendamento(context) {
  const cleanPhone = context.telefone.replace(/\D/g, '');

  // Buscar profissional e serviço
  const { data: pro } = await supabase
    .from('professionals')
    .select('*')
    .eq('id', context.prof_id)
    .single();

  const { data: svc } = await supabase
    .from('services')
    .select('*')
    .eq('id', context.servico_id)
    .single();

  const clienteFinal = context.para === 'mim'
    ? context.nome.trim()
    : `${context.nome.trim()} · ${context.dependente_nome?.trim()}`;

  // UPSERT cliente - buscar ou criar
  const { data: cliente, error: clienteError } = await supabase
    .from('clients')
    .upsert(
      {
        nome: context.nome.trim(),
        tel: cleanPhone,
        visitas: 0,
        total_gasto: 0
      },
      { onConflict: 'tel', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (clienteError) {
    // Se der erro no upsert, tentar buscar o cliente existente
    const { data: existingClient } = await supabase
      .from('clients')
      .select('*')
      .eq('tel', cleanPhone)
      .single();
    
    if (!existingClient) {
      throw new Error('Erro ao criar/buscar cliente');
    }
  }

  // Criar agendamento
  const { data: appt } = await supabase
    .from('appointments')
    .insert({
      prof_id: pro.id,
      data: context.data,
      hora: context.hora,
      servico: svc.nome,
      servico_id: svc.id,
      duracao: svc.duracao,
      valor: svc.preco,
      cliente: clienteFinal,
      tel: cleanPhone,
      dependente_nome: context.para === 'mim' ? null : context.dependente_nome?.trim(),
      status: 'agendado',
      origem: 'whatsapp'
    })
    .select()
    .single();

  // Abrir comanda
  const { data: lastCmd } = await supabase
    .from('commands')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNum = (lastCmd?.numero || 0) + 1;

  const { data: cmd } = await supabase
    .from('commands')
    .insert({
      numero: nextNum,
      cliente_nome: clienteFinal,
      status: 'aberta',
      abertura: new Date().toISOString(),
      valor: Number(svc.preco)
    })
    .select()
    .single();

  if (cmd) {
    await supabase.from('command_items').insert({
      command_id: cmd.id,
      descricao: svc.nome,
      valor: Number(svc.preco),
      prof_id: pro.id,
      tipo: 'servico'
    });
  }

  return { appt, pro, svc };
}

/**
 * Processa mensagem
 */
async function processarMensagem(phone, userMessage) {
  // Recuperar ou criar conversa
  let conv = conversations.get(phone);
  
  if (!conv) {
    conv = {
      context: { telefone: phone },
      history: [],
      lastUpdate: Date.now()
    };
    conversations.set(phone, conv);
  }

  // Atualizar timestamp
  conv.lastUpdate = Date.now();

  // Buscar dados
  const { professionals, services, settings } = await buscarDados();

  // Montar contexto
  let contextInfo = '\n\nCONTEXTO ATUAL:\n';
  if (conv.context.nome) contextInfo += `Nome: ${conv.context.nome}\n`;
  if (conv.context.para) contextInfo += `Para: ${conv.context.para}\n`;
  if (conv.context.dependente_nome) contextInfo += `Dependente: ${conv.context.dependente_nome}\n`;
  if (conv.context.prof_id) {
    const pro = professionals.find(p => p.id === conv.context.prof_id);
    if (pro) contextInfo += `Barbeiro: ${pro.nome}\n`;
  }
  if (conv.context.servico_id) {
    const svc = services.find(s => s.id === conv.context.servico_id);
    if (svc) contextInfo += `Serviço: ${svc.nome} - R$ ${svc.preco}\n`;
  }
  if (conv.context.data) contextInfo += `Data: ${conv.context.data}\n`;
  if (conv.context.hora) contextInfo += `Horário: ${conv.context.hora}\n`;

  contextInfo += '\n\nBAR BEIROS:\n';
  professionals.forEach((p, i) => {
    contextInfo += `${i + 1}. ${p.nome} (${p.categoria}) [ID: ${p.id}]\n`;
  });

  contextInfo += '\nSERVIÇOS:\n';
  services.forEach((s, i) => {
    contextInfo += `${i + 1}. ${s.nome} - ${s.duracao}min - R$ ${s.preco.toFixed(2)} [ID: ${s.id}]\n`;
  });

  // Horários disponíveis
  if (conv.context.prof_id && conv.context.data && settings) {
    const slots = generateSlots(
      settings.horario_inicio,
      settings.horario_fim,
      settings.slot_minutos
    );
    const ocupados = await buscarOcupados(conv.context.prof_id, conv.context.data);
    const livres = slots.filter(s => !ocupados.includes(s));

    contextInfo += '\nHORÁRIOS LIVRES:\n';
    if (livres.length > 0) {
      livres.forEach((h, i) => contextInfo += `${i + 1}. ${h}\n`);
    } else {
      contextInfo += 'Nenhum horário disponível nesta data.\n';
    }
  }

  // Adicionar mensagem ao histórico
  conv.history.push({ role: 'user', content: userMessage });

  // Chamar OpenAI
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + contextInfo },
    ...conv.history
  ];

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 300
  });

  const resposta = completion.choices[0].message.content;
  conv.history.push({ role: 'assistant', content: resposta });

  // Extrair informações (parsing simples)
  if (!conv.context.nome && userMessage.length > 5) {
    // Tentar extrair nome
    const palavras = userMessage.trim().split(/\s+/);
    if (palavras.length >= 2 && palavras.length <= 4) {
      conv.context.nome = userMessage.trim();
    }
  }

  // Extrair escolhas por número ou nome
  professionals.forEach((p, i) => {
    if (userMessage.includes(String(i + 1)) || 
        userMessage.toLowerCase().includes(p.nome.toLowerCase())) {
      conv.context.prof_id = p.id;
    }
  });

  services.forEach((s, i) => {
    if (userMessage.includes(String(i + 1)) || 
        userMessage.toLowerCase().includes(s.nome.toLowerCase())) {
      conv.context.servico_id = s.id;
    }
  });

  // Verificar se deve confirmar
  if (resposta.includes('CONFIRMAR_AGENDAMENTO')) {
    try {
      const { appt, pro, svc } = await criarAgendamento(conv.context);

      const dataFormatada = new Date(conv.context.data + 'T00:00:00')
        .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

      const mensagemFinal = `✅ *Agendamento confirmado!*

Seu horário está garantido! 🎉

📋 *Detalhes:*
• ${dataFormatada}
• Horário: ${conv.context.hora}
• Serviço: ${svc.nome}
• Profissional: ${pro.nome}
• Valor: R$ ${svc.preco.toFixed(2)}

🔔 Você receberá um lembrete 30 minutos antes do horário.

📍 *Barbearia Status*
Coxim, MS

Até lá! ✂️`;

      await sendWhatsApp(phone, mensagemFinal);
      
      console.log(`🎉 Agendamento ${appt.id} criado para ${phone}`);
      
      // Limpar conversa após 5 segundos
      setTimeout(() => {
        conversations.delete(phone);
        console.log(`🧹 Conversa de ${phone} limpa`);
      }, 5000);

      return;
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      await sendWhatsApp(phone, 'Desculpe, ocorreu um erro ao confirmar. Pode tentar novamente?');
      return;
    }
  }

  // Enviar resposta normal
  await sendWhatsApp(phone, resposta.replace('CONFIRMAR_AGENDAMENTO', '').trim());
}

// Servidor Express
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    conversations: conversations.size,
    timestamp: new Date().toISOString()
  });
});

// Webhook
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Verificar evento
    if (payload.event !== 'messages.upsert') {
      return res.json({ ok: true });
    }

    const message = payload.data;

    // Ignorar mensagens enviadas por nós ou de grupos
    if (message.key.fromMe || message.key.remoteJid.includes('@g.us')) {
      return res.json({ ok: true });
    }

    const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const userMessage = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';

    if (!userMessage) {
      return res.json({ ok: true });
    }

    console.log(`📱 [${phone}]: ${userMessage}`);

    // Processar em background
    processarMensagem(phone, userMessage).catch(err => {
      console.error('Erro ao processar:', err);
    });

    res.json({ ok: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🤖 ═══════════════════════════════════════════');
  console.log('🤖  AGENTE DE IA - BARBEARIA STATUS');
  console.log('🤖 ═══════════════════════════════════════════');
  console.log('');
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📱 Evolution API:', EVOLUTION_URL);
  console.log('📱 Instância:', EVOLUTION_INSTANCE);
  console.log('🤖 Modelo OpenAI:', OPENAI_MODEL);
  console.log('');
  console.log('✅ Aguardando mensagens...');
  console.log('');
});
