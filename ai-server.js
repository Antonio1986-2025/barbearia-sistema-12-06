/**
 * Servidor do Agente de IA para WhatsApp
 * Recebe webhooks da Evolution API e processa mensagens
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

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
        if (!process.env[key]) {
          process.env[key] = value;
        }
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
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch }
});
console.log(`🔐 Supabase URL: ${SUPABASE_URL.substring(0, 30)}... key: ${SUPABASE_KEY.substring(0, 15)}...`);
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
const SYSTEM_PROMPT = `Você é um assistente virtual da Barbearia Status em Coxim, MS. Seu OBJETIVO é conseguir um agendamento completo: nome, serviço, barbeiro, data e horário.

INFORMAÇÕES DA BARBEARIA:
- Nome: Barbearia Status - Coxim, MS - Desde 1991
- Especialidade: Cortes masculinos, barbas e acabamentos profissionais

SEU COMPORTAMENTO:
- Seja natural como um atendente de verdade. Converse, pergunte, responda dúvidas
- Se o cliente disser algo fora do contexto, ignore educadamente e volte ao objetivo
- Cliente pode dar informações em qualquer ordem: aproveite o que ele disser e peça o que faltar
- Seja breve - mensagens curtas funcionam melhor no WhatsApp
- Chame o cliente pelo nome quando souber

DADOS NECESSÁRIOS (em qualquer ordem):
- Nome do cliente
- Serviço desejado (mostre as opções do contexto)
- Barbeiro (mostre as opções do contexto)
- Data (próximos dias úteis)
- Horário (mostre os disponíveis do contexto)

QUANDO CONFIRMAR:
- Quando tiver TODOS os dados e o cliente confirmar, responda APENAS: CONFIRMAR_AGENDAMENTO
- Se faltar algum dado, peça naturalmente
- Não force um pedido específico - adapte ao que o cliente falou

REGRAS:
- NÃO invente dados - use apenas o que está no contexto
- NÃO finalize sem confirmação explícita do cliente
- Uma pergunta por vez
- Cliente pode responder com números para escolher opções, mas também pode digitar o nome

EXEMPLOS:
Cliente: "Quero cortar o cabelo amanhã com o Luan"
Você: "Beleza! 💈 Qual é o seu nome completo?"

Cliente: "João, quero barba também"
Você: "Corte + Barba, R$ 90. Seu nome é João, certo? Qual o sobrenome?"

Cliente: "João Silva, quero às 15h"
Você: "Perfeito, João! Deixa eu confirmar:
- Serviço: Corte + Barba
- Barbeiro: Luan
- Data: amanhã
- Horário: 15h
Tudo certo?"`;

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

  console.log(`📊 DB: professionals=${prosResult.data?.length || 0} services=${svcsResult.data?.length || 0} erros: ${prosResult.error ? 'pro=' + prosResult.error.message : 'none'} ${svcsResult.error ? 'svc=' + svcsResult.error.message : 'none'}`);

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
  const { data: pro, error: proError } = await supabase
    .from('professionals')
    .select('*')
    .eq('id', context.prof_id)
    .single();

  const { data: svc, error: svcError } = await supabase
    .from('services')
    .select('*')
    .eq('id', context.servico_id)
    .single();

  console.log(`🔍 Buscando prof_id=${context.prof_id} → ${pro ? 'encontrado: ' + pro.nome : 'NULL'}${proError ? ' ERRO: ' + proError.message : ''}`);
  console.log(`🔍 Buscando servico_id=${context.servico_id} → ${svc ? 'encontrado: ' + svc.nome : 'NULL'}${svcError ? ' ERRO: ' + svcError.message : ''}`);

  if (!pro) {
    const { data: allPros } = await supabase.from('professionals').select('id, nome');
    console.log(`📋 Profissionais disponíveis: ${JSON.stringify(allPros)}`);
    throw new Error(`Profissional não encontrado (ID: ${context.prof_id})`);
  }

  if (!svc) {
    const { data: allSvcs } = await supabase.from('services').select('id, nome');
    console.log(`📋 Serviços disponíveis: ${JSON.stringify(allSvcs)}`);
    throw new Error(`Serviço não encontrado (ID: ${context.servico_id})`);
  }

  if (!context.data) {
    throw new Error('Data não informada');
  }

  if (!context.hora) {
    throw new Error('Horário não informado');
  }

  const clienteFinal = context.para === 'mim'
    ? context.nome.trim()
    : `${context.nome.trim()} · ${context.dependente_nome?.trim()}`;

  // BUSCAR cliente existente pelo telefone (evita duplicidade)
  let { data: cliente } = await supabase
    .from('clients')
    .select('*')
    .eq('tel', cleanPhone)
    .maybeSingle();

  if (!cliente) {
    // Criar novo cliente
    const { data: novoCliente, error: createError } = await supabase
      .from('clients')
      .insert({
        nome: context.nome.trim(),
        tel: cleanPhone,
        visitas: 1,
        total_gasto: 0
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Erro ao criar cliente: ${createError.message}`);
    }
    cliente = novoCliente;
  } else if (cliente.nome !== context.nome.trim()) {
    // Atualizar nome se mudou
    await supabase.from('clients').update({ nome: context.nome.trim() }).eq('id', cliente.id);
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
async function processarMensagem(phone, userMessage, imageBase64 = null, mimeType = null) {
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

  contextInfo += '\n\nBARBEIROS:\n';
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
  if (imageBase64) {
    conv.history.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage || '[Imagem enviada]' },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
      ]
    });
  } else {
    conv.history.push({ role: 'user', content: userMessage });
  }

  // Chamar OpenAI
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + contextInfo },
    ...conv.history
  ];

  const completion = await openai.chat.completions.create({
    model: imageBase64 ? 'gpt-4o-mini' : OPENAI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: imageBase64 ? 500 : 300
  });

  const resposta = completion.choices[0].message.content;
  conv.history.push({ role: 'assistant', content: resposta });

  // Extrair informações (parsing simples)
  const msgLower = userMessage.trim().toLowerCase();

  // Extrair nome (só quando explícito: "meu nome é", "me chamo", "sou", "meu nome", etc.)
  if (!conv.context.nome && userMessage.length > 3) {
    const nomeMatch = userMessage.match(/(?:meu nome é|me chamo|sou o? a?|meu nome|nome é|me dá|pode me chamar)\s+(.+)/i);
    if (nomeMatch) {
      const nome = nomeMatch[1].trim().replace(/[.!?,;]+$/, '');
      if (nome.length > 2 && nome.length < 50) {
        conv.context.nome = nome;
        console.log(`🔍 Nome extraído: ${conv.context.nome}`);
      }
    }
    // Fallback: se são 2-3 palavras com inicial maiúscula, parece nome proprio
    if (!conv.context.nome) {
      const palavras = userMessage.trim().split(/\s+/);
      const palavrasIgnoradas = ['quero', 'vou', 'preciso', 'gostaria', 'fazer', 'corte', 'cortar', 'barba', 'cabelo', 'hoje', 'amanhã', 'agendar', 'marcar', 'quero', 'sim', 'não', 'ok', 'blz', 'pra', 'para', 'mim', 'obrigado', 'obrigada', 'oi', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite'];
      if (palavras.length >= 2 && palavras.length <= 3 &&
          palavras.every(p => /^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ]/.test(p)) &&
          palavras.every(p => !palavrasIgnoradas.includes(p.toLowerCase()))) {
        conv.context.nome = userMessage.trim();
        console.log(`🔍 Nome extraído (heurística): ${conv.context.nome}`);
      }
    }
  }

  // Extrair "para quem é"
  if (conv.context.nome && !conv.context.para) {
    if (msgLower === 'sim' || msgLower === 'pra mim' || msgLower === 'para mim') {
      conv.context.para = 'mim';
    } else if (msgLower === 'outra pessoa' || msgLower === 'outro' || msgLower === 'para outra pessoa') {
      conv.context.para = 'outra';
    }
  }

  // Extrair nome do dependente (se para = outra)
  if (conv.context.para === 'outra' && !conv.context.dependente_nome && userMessage.length > 2) {
    conv.context.dependente_nome = userMessage.trim();
  }

  // Extrair data
  if (!conv.context.data) {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    if (msgLower === 'hoje' || msgLower === 'hoje mesmo' || msgLower === 'hj' || msgLower === 'hje' || msgLower === 'agr' || msgLower === 'agora') {
      conv.context.data = hojeStr;
    } else if (msgLower === 'amanhã' || msgLower === 'amanha' || msgLower === 'amm' || msgLower === 'amh') {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      conv.context.data = amanha.toISOString().split('T')[0];
    } else {
      // Tentar extrair data no formato DD/MM ou DD-MM
      const dateMatch = userMessage.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3] ? dateMatch[3].padStart(4, '20') : String(hoje.getFullYear());
        conv.context.data = `${year}-${month}-${day}`;
      }
    }
  }

  // Extrair hora (só se já tem profissional E serviço — senão "15" pode ser escolha de barbeiro/serviço)
  if (!conv.context.hora && conv.context.prof_id && conv.context.servico_id) {
    // "18:00", "18h00", "18h"
    const timeMatch = userMessage.match(/(\d{1,2})[h:](\d{2})/);
    if (timeMatch) {
      conv.context.hora = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    } else {
      // "às 15", "as 15", "15 horas" — hora sem minutos
      const hourOnly = userMessage.match(/(?:às|as|horas?)\s+(\d{1,2})/i);
      if (hourOnly) {
        const h = parseInt(hourOnly[1]);
        if (h >= 8 && h <= 20) {
          conv.context.hora = `${String(h).padStart(2, '0')}:00`;
        }
      }
    }
  }

  // Extrair barbeiro por nome (case-insensitive, parcial)
  if (!conv.context.prof_id) {
    for (const p of professionals) {
      if (msgLower.includes(p.nome.toLowerCase()) || p.nome.toLowerCase().includes(msgLower)) {
        conv.context.prof_id = p.id;
        break;
      }
    }
  }

  // Extrair barbeiro por número (se ainda não tem profissional)
  if (!conv.context.prof_id) {
    const numMatch = msgLower.match(/^(\d+)$/);
    if (numMatch && !conv.context.servico_id) {
      const idx = parseInt(numMatch[1]) - 1;
      if (idx >= 0 && idx < professionals.length) {
        conv.context.prof_id = professionals[idx].id;
        console.log(`🔍 Profissional #${numMatch[1]} → ${professionals[idx].nome} (id: ${professionals[idx].id})`);
      } else {
        console.log(`⚠️ Profissional #${numMatch[1]} não existe. Total: ${professionals.length}`);
      }
    }
  }

  // Extrair serviço por nome ou número
  if (!conv.context.servico_id) {
    for (const s of services) {
      if (msgLower.includes(s.nome.toLowerCase()) || s.nome.toLowerCase().includes(msgLower)) {
        conv.context.servico_id = s.id;
        break;
      }
    }
  }

  // Extrair serviço por número (só se já tem profissional)
  if (!conv.context.servico_id && conv.context.prof_id) {
    const numMatch = msgLower.match(/^(\d+)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1]) - 1;
      if (idx >= 0 && idx < services.length) {
        conv.context.servico_id = services[idx].id;
        console.log(`🔍 Serviço #${numMatch[1]} → ${services[idx].nome} (id: ${services[idx].id})`);
      } else {
        console.log(`⚠️ Serviço #${numMatch[1]} não existe. Total: ${services.length}`);
      }
    }
  }

  // Verificar se deve confirmar
  if (resposta.includes('CONFIRMAR_AGENDAMENTO')) {
    console.log(`🔍 Contexto antes de criar agendamento:`, JSON.stringify(conv.context, null, 2));

    // Verificar se todos os dados obrigatórios estão preenchidos
    const missing = [];
    if (!conv.context.prof_id) missing.push('barbeiro');
    if (!conv.context.servico_id) missing.push('serviço');
    if (!conv.context.data) missing.push('data');
    if (!conv.context.hora) missing.push('horário');

    if (missing.length > 0) {
      const msg = `Faltam informações para confirmar: ${missing.join(', ')}. Pode me informar?`;
      console.log(`⚠️ Dados faltantes: ${missing.join(', ')}`);
      await sendWhatsApp(phone, msg);
      return;
    }

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

/**
 * Baixa mídia da Evolution API
 */
async function downloadMedia(messageKey) {
  const { data } = await axios({
    method: 'POST',
    url: `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
    headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    data: { message: { key: { id: messageKey } }, convertToMp4: false },
  });
  if (data.base64) {
    return Buffer.from(data.base64, 'base64');
  }
  return Buffer.from(data);
}

/**
 * Transcreve áudio usando Whisper
 */
async function transcribeAudio(audioBuffer) {
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
  });
  return transcription.text;
}

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
    const msgText = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
    const audioMsg = message.message?.audioMessage;
    const imageMsg = message.message?.imageMessage;
    const caption = imageMsg?.caption || '';

    if (audioMsg) {
      console.log(`🎵 [${phone}]: Áudio recebido`);
      res.json({ ok: true });
      downloadMedia(message.key.id).then(audioBuffer => {
        return transcribeAudio(audioBuffer);
      }).then(transcription => {
        console.log(`📝 [${phone}]: Transcrição: ${transcription}`);
        return processarMensagem(phone, transcription);
      }).catch(err => console.error('Erro ao processar áudio:', err.message || err));
      return;
    }

    if (imageMsg) {
      console.log(`🖼️ [${phone}]: Imagem recebida`);
      res.json({ ok: true });
      downloadMedia(message.key.id).then(imageBuffer => {
        const imageBase64 = imageBuffer.toString('base64');
        const mimeType = imageMsg.mimetype || 'image/jpeg';
        return processarMensagem(phone, caption || '[Imagem enviada]', imageBase64, mimeType);
      }).catch(err => console.error('Erro ao processar imagem:', err.message || err));
      return;
    }

    if (!msgText) {
      return res.json({ ok: true });
    }

    console.log(`📱 [${phone}]: ${msgText}`);

    // Processar em background
    processarMensagem(phone, msgText).catch(err => {
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
