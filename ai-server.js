/**
 * Servidor do Agente de IA para WhatsApp - v3.0
 * Usa OpenAI Function Calling para extração robusta de dados
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

// ============================================================
// CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
// ============================================================
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
<<<<<<< HEAD
        let value = match[2].trim();
        value = value.replace(/^["']|["']$/g, '');
        env[key] = value;
        if (!process.env[key]) {
          process.env[key] = value;
        }
=======
        let value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
      }
    });
    console.log('✅ Arquivo .env carregado');
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.log('ℹ️ Rodando em produção - usando variáveis de ambiente');
    } else {
      console.warn('⚠️ Arquivo .env não encontrado:', error.message);
    }
  }
}

loadEnv();

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const PORT = process.env.PORT || process.env.AI_PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || process.env.EVOLUTION_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Supabase não configurado'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('❌ OpenAI API Key não configurada'); process.exit(1); }
if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) { console.error('❌ Evolution API não configurada'); process.exit(1); }

<<<<<<< HEAD
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
=======
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const conversations = new Map();

setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  for (const [phone, conv] of conversations.entries()) {
    if (now - conv.lastUpdate > ONE_HOUR) {
      conversations.delete(phone);
      console.log(`🧹 Conversa de ${phone} expirou`);
    }
  }
}, 60 * 60 * 1000);

<<<<<<< HEAD
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
- Quando tiver TODOS os 5 dados acima confirmados PELO CLIENTE E eles estiverem visíveis no CONTEXTO ATUAL, responda APENAS: CONFIRMAR_AGENDAMENTO
- Se faltar algum dado na seção CONTEXTO ATUAL, pergunte naturalmente
- NUNCA confirme se CONTEXTO ATUAL não mostrar todos os campos preenchidos
- Se o cliente disser apenas "Sim" e CONTEXTO ATUAL estiver incompleto, peça o que falta

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

/**
 * Envia mensagem via WhatsApp
 */
=======
const SYSTEM_PROMPT = `Você é um assistente virtual da Barbearia Status em Coxim, MS, especializado em agendamentos via WhatsApp.

INFORMAÇÕES DA BARBEARIA:
- Nome: Barbearia Status
- Localização: Coxim, MS
- Desde: 1991

SEU COMPORTAMENTO:
- Seja amigável, profissional e direto
- Use linguagem informal mas respeitosa
- Mensagens curtas funcionam melhor no WhatsApp
- Use emojis com moderação
- Chame o cliente pelo nome quando souber

DADOS NECESSÁRIOS PARA AGENDAMENTO:
1. Nome completo do cliente (titular do telefone)
2. Para quem é o serviço (próprio cliente ou dependente)
3. Se for dependente: nome do dependente
4. Profissional escolhido
5. Serviço escolhido
6. Data
7. Horário

INSTRUÇÕES IMPORTANTES:
- Use a função "extrairDadosAgendamento" SEMPRE que o cliente mencionar qualquer dado novo
- Mesmo se a primeira mensagem já trouxer vários dados, extraia TODOS de uma vez
- Use a função "confirmarAgendamento" APENAS quando TODOS os dados estiverem completos E o cliente confirmar
- Se faltar algum dado, pergunte de forma natural
- Antes de confirmar, SEMPRE recapitule todos os dados e peça confirmação explícita
- Sempre apresente as opções numeradas (1, 2, 3...) para profissionais e serviços`;

const FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "extrairDadosAgendamento",
      description: "Extrai dados do agendamento da mensagem do cliente. Use SEMPRE que houver qualquer informação nova.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do CLIENTE TITULAR (dono do telefone)" },
          para: { type: "string", enum: ["mim", "outro"], description: "Quem vai receber: 'mim' ou 'outro' (dependente)" },
          dependente_nome: { type: "string", description: "Nome do dependente (filho, esposa, etc)" },
          profissional_nome: { type: "string", description: "Nome do profissional/barbeiro" },
          servico_nome: { type: "string", description: "Nome do serviço" },
          data: { type: "string", description: "Data em formato YYYY-MM-DD. Converta 'hoje', 'amanhã', etc." },
          hora: { type: "string", description: "Horário em formato HH:MM (24h). Ex: '13h' → '13:00'" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "confirmarAgendamento",
      description: "Confirma e cria o agendamento. SOMENTE chame após cliente confirmar explicitamente.",
      parameters: {
        type: "object",
        properties: {
          confirmado: { type: "boolean", description: "Se cliente confirmou explicitamente" }
        },
        required: ["confirmado"]
      }
    }
  }
];

>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
async function sendWhatsApp(phone, message) {
  // Parar indicador de digitação antes de enviar
  try {
    await axios.put(
      `${EVOLUTION_URL}/chat/presence/${EVOLUTION_INSTANCE}`,
      { number: phone, presence: 'available' },
      {
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        timeout: 2000
      }
    );
  } catch {}
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: phone, text: message },
      { headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Mensagem enviada para ${phone}`);
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

<<<<<<< HEAD
/**
 * Envia indicador de digitação (mostra "..." no WhatsApp)
 */
async function sendTyping(phone) {
  try {
    await axios.put(
      `${EVOLUTION_URL}/chat/presence/${EVOLUTION_INSTANCE}`,
      {
        number: phone,
        presence: 'composing'
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      }
    );
  } catch (error) {
    // Não crítico - apenas log silencioso
    if (process.env.NODE_ENV !== 'production') {
      console.log('ℹ️ Typing indicator not supported by Evolution version');
    }
  }
}

/**
 * Envia indicador de "parou de digitar" (opcional)
 */
async function sendStopTyping(phone) {
  try {
    await axios.put(
      `${EVOLUTION_URL}/chat/presence/${EVOLUTION_INSTANCE}`,
      {
        number: phone,
        presence: 'available'
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      }
    );
  } catch {
    // Não crítico
  }
}

/**
 * Busca dados do Supabase
 */
=======
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
async function buscarDados() {
  const [pros, svcs, settings] = await Promise.all([
    supabase.from('professionals').select('id, nome, categoria').eq('ativo', true).order('ordem'),
    supabase.from('services').select('id, nome, duracao, preco').eq('ativo', true).order('ordem'),
    supabase.from('settings').select('*').maybeSingle()
  ]);
<<<<<<< HEAD

  console.log(`📊 DB: professionals=${prosResult.data?.length || 0} services=${svcsResult.data?.length || 0} erros: ${prosResult.error ? 'pro=' + prosResult.error.message : 'none'} ${svcsResult.error ? 'svc=' + svcsResult.error.message : 'none'}`);

  return {
    professionals: prosResult.data || [],
    services: svcsResult.data || [],
    settings: settingsResult.data
  };
=======
  if (pros.error) console.error('❌ Erro ao buscar profissionais:', pros.error);
  if (svcs.error) console.error('❌ Erro ao buscar serviços:', svcs.error);
  console.log(`📊 DB: professionals=${pros.data?.length || 0} services=${svcs.data?.length || 0}`);
  return { professionals: pros.data || [], services: svcs.data || [], settings: settings.data };
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
}

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

async function buscarOcupados(profId, data) {
  const { data: result } = await supabase
    .from('appointments')
    .select('hora')
    .eq('prof_id', profId)
    .eq('data', data)
    .neq('status', 'cancelado');
  return (result || []).map(r => r.hora.slice(0, 5));
}

function encontrarProfissional(nome, professionals) {
  if (!nome) return null;
  const nomeLower = nome.toLowerCase().trim();
  let found = professionals.find(p => p.nome.toLowerCase() === nomeLower);
  if (found) return found;
  found = professionals.find(p => p.nome.toLowerCase().includes(nomeLower) || nomeLower.includes(p.nome.toLowerCase()));
  if (found) return found;
  const primeiroNome = nomeLower.split(' ')[0];
  found = professionals.find(p => p.nome.toLowerCase().split(' ')[0] === primeiroNome);
  return found || null;
}

function encontrarServico(nome, services) {
  if (!nome) return null;
  const nomeLower = nome.toLowerCase().trim();
  let found = services.find(s => s.nome.toLowerCase() === nomeLower);
  if (found) return found;
  found = services.find(s => s.nome.toLowerCase().includes(nomeLower) || nomeLower.includes(s.nome.toLowerCase()));
  return found || null;
}

async function criarAgendamento(context) {
  console.log('🔨 [criarAgendamento] Iniciando...');
  console.log('📋 Contexto recebido:', JSON.stringify(context, null, 2));

<<<<<<< HEAD
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
=======
  const erros = [];
  if (!context.nome) erros.push('nome do cliente');
  if (!context.prof_id) erros.push('profissional');
  if (!context.servico_id) erros.push('serviço');
  if (!context.data) erros.push('data');
  if (!context.hora) erros.push('horário');
  if (erros.length > 0) throw new Error(`Dados faltando: ${erros.join(', ')}`);

  const cleanPhone = String(context.telefone).replace(/\D/g, '');

  const { data: pro, error: proError } = await supabase.from('professionals').select('*').eq('id', context.prof_id).single();
  if (proError || !pro) throw new Error(`Profissional não encontrado (id: ${context.prof_id})`);

  const { data: svc, error: svcError } = await supabase.from('services').select('*').eq('id', context.servico_id).single();
  if (svcError || !svc) throw new Error(`Serviço não encontrado (id: ${context.servico_id})`);

  console.log(`✅ Profissional: ${pro.nome}, Serviço: ${svc.nome}`);

  const nomeTitular = String(context.nome || '').trim();
  const nomeDep = String(context.dependente_nome || '').trim();
  const clienteFinal = (context.para === 'outro' && nomeDep) ? `${nomeTitular} · ${nomeDep}` : nomeTitular;

  console.log(`👤 Cliente final: ${clienteFinal}`);

  const { error: clienteError } = await supabase.from('clients').upsert(
    { nome: nomeTitular, tel: cleanPhone, visitas: 0, total_gasto: 0 },
    { onConflict: 'tel', ignoreDuplicates: false }
  );
  if (clienteError) console.warn('⚠️ Aviso no upsert de cliente:', clienteError.message);

  const { data: appt, error: apptError } = await supabase.from('appointments').insert({
    prof_id: pro.id,
    data: context.data,
    hora: context.hora,
    servico: svc.nome,
    servico_id: svc.id,
    duracao: svc.duracao,
    valor: svc.preco,
    cliente: clienteFinal,
    tel: cleanPhone,
    dependente_nome: context.para === 'outro' ? nomeDep : null,
    status: 'agendado',
    origem: 'whatsapp'
  }).select().single();

  if (apptError || !appt) {
    console.error('❌ Erro ao inserir agendamento:', apptError);
    throw new Error(`Erro ao criar agendamento: ${apptError?.message || 'desconhecido'}`);
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
  }

  console.log(`📅 Agendamento criado: ${appt.id}`);

  try {
    const { data: lastCmd } = await supabase.from('commands').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle();
    const nextNum = (lastCmd?.numero || 0) + 1;
    const { data: cmd, error: cmdError } = await supabase.from('commands').insert({
      numero: nextNum, cliente_nome: clienteFinal, status: 'aberta',
      abertura: new Date().toISOString(), valor: Number(svc.preco)
    }).select().single();
    if (cmd && !cmdError) {
      await supabase.from('command_items').insert({
        command_id: cmd.id, descricao: svc.nome, valor: Number(svc.preco),
        prof_id: pro.id, tipo: 'servico'
      });
      console.log(`💼 Comanda aberta: #${nextNum}`);
    }
  } catch (cmdErr) {
    console.warn('⚠️ Erro ao abrir comanda:', cmdErr.message);
  }

  return { appt, pro, svc };
}

<<<<<<< HEAD
/**
 * Processa mensagem
 */
async function processarMensagem(phone, userMessage, imageBase64 = null, mimeType = null) {
  // Mostrar "digitando..." no WhatsApp do cliente
  sendTyping(phone);

  // Recuperar ou criar conversa
  let conv = conversations.get(phone);
  
  if (!conv) {
    conv = {
      context: { telefone: phone },
      history: [],
      lastUpdate: Date.now()
    };
    conversations.set(phone, conv);
=======
async function processarExtracao(args, context, professionals, services) {
  const updates = {};
  if (args.nome && !context.nome) {
    updates.nome = args.nome.trim();
    console.log(`📝 Nome extraído: ${updates.nome}`);
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
  }
  if (args.para) {
    updates.para = args.para;
    console.log(`👥 Para: ${args.para}`);
  }
  if (args.dependente_nome) {
    updates.dependente_nome = args.dependente_nome.trim();
    console.log(`👶 Dependente: ${updates.dependente_nome}`);
  }
<<<<<<< HEAD
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
=======
  if (args.profissional_nome && !context.prof_id) {
    const pro = encontrarProfissional(args.profissional_nome, professionals);
    if (pro) {
      updates.prof_id = pro.id;
      console.log(`👤 Profissional encontrado: ${pro.nome} (id: ${pro.id})`);
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
    } else {
      console.log(`⚠️ Profissional não encontrado: "${args.profissional_nome}"`);
    }
  }
<<<<<<< HEAD

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
      let nome = nomeMatch[1].trim().replace(/[.!?,;]+$/g, '');
      // Cortar em palavras que marcam fim do nome
      const fimNome = nome.search(/\s+(e|pra|para|é|vou|quero|preciso|gostaria|agendar|marcar|hoje|amanhã|às|as|horas?|do|da|de|como|com|se|seu|sua|meu|minha|tem|ter|ser|no|na|em|um|uma)\s+/i);
      if (fimNome > 0) {
        nome = nome.substring(0, fimNome);
      }
      // Remove qualquer pontuação residual do final
      nome = nome.replace(/[.,!?;]+$/g, '').trim();
      if (nome.length > 2 && nome.length < 50 && /\s/.test(nome)) {
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
    if (msgLower.includes('pra mim') || msgLower.includes('para mim') || msgLower === 'sim') {
      conv.context.para = 'mim';
    } else if (msgLower === 'outra pessoa' || msgLower === 'outro' || msgLower.includes('para outra')) {
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

    if (/\b(hoje|hj|hje|agr|agora)\b/i.test(msgLower)) {
      conv.context.data = hojeStr;
    } else if (/\b(amanhã|amanha|amm|amh)\b/i.test(msgLower) || /\bdepois de amanh[ãa]\b/i.test(msgLower)) {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + (msgLower.includes('depois') ? 2 : 1));
      conv.context.data = amanha.toISOString().split('T')[0];
    } else {
      // Tentar extrair data no formato DD/MM ou DD-MM
      const dateMatch = userMessage.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3] ? dateMatch[3].padStart(4, '20') : String(hoje.getFullYear());
        conv.context.data = `${year}-${month}-${day}`;
      } else {
        // Nenhuma menção de data → assume HOJE como padrão
        conv.context.data = hojeStr;
        console.log(`📅 Data não mencionada, assumindo hoje: ${hojeStr}`);
      }
    }
  }

  // Extrair barbeiro por nome (case-insensitive, parcial, sem acentos)
  if (!conv.context.prof_id) {
    const msgNoAccent = msgLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const p of professionals) {
      const nomeNoAccent = p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (msgNoAccent.includes(nomeNoAccent) || nomeNoAccent.includes(msgNoAccent)) {
        conv.context.prof_id = p.id;
        console.log(`🔍 Profissional por nome: "${msgLower}" → ${p.nome} (id: ${p.id})`);
        break;
      }
    }
  }

  // Extrair serviço por nome (case-insensitive, parcial, sem acentos)
  if (!conv.context.servico_id) {
    const msgNoAccent = msgLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Coleta todos os matches, depois escolhe o melhor (mais específico)
    const svcNoAccent = s => s.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isSimple = s => !s.nome.includes('/') && !s.nome.toLowerCase().includes('domicilio');

    let matches = services.filter(s => {
      const n = svcNoAccent(s);
      return msgNoAccent.includes(n) || n.includes(msgNoAccent);
    });
    if (matches.length > 0) {
      // Preferir serviço simples (sem /) sobre combo
      matches.sort((a, b) => (isSimple(a) ? 0 : 1) - (isSimple(b) ? 0 : 1) || a.nome.length - b.nome.length);
      conv.context.servico_id = matches[0].id;
      console.log(`🔍 Serviço por nome: "${msgLower}" → ${matches[0].nome} (id: ${matches[0].id})`);
    }
    // Match por palavra-chave (se ainda não encontrou)
    if (!conv.context.servico_id) {
      const palavrasMsg = msgNoAccent.split(/\s+/);
      let wordMatches = services.filter(s => {
        const palavrasSvc = svcNoAccent(s).split(/\s+/);
        return palavrasSvc.some(pSvc =>
          pSvc.length > 2 && palavrasMsg.some(pMsg =>
            pMsg.includes(pSvc) || pSvc.includes(pMsg)
          )
        );
      });
      if (wordMatches.length > 0) {
        wordMatches.sort((a, b) => (isSimple(a) ? 0 : 1) - (isSimple(b) ? 0 : 1) || a.nome.length - b.nome.length);
        conv.context.servico_id = wordMatches[0].id;
        console.log(`🔍 Serviço por palavra-chave: "${msgLower}" → ${wordMatches[0].nome} (id: ${wordMatches[0].id})`);
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

  // Inferir serviço do contexto (com match parcial — prefere serviços simples)
  if (!conv.context.servico_id && conv.context.prof_id) {
    const msgNoAccent = msgLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const svcNoAccent = s => s.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isSimple = s => !s.nome.includes('/') && !s.nome.toLowerCase().includes('domicilio');

    const findBest = (stem) => {
      const all = services.filter(s => svcNoAccent(s).includes(stem));
      if (all.length === 0) return null;
      all.sort((a, b) => (isSimple(a) ? 0 : 1) - (isSimple(b) ? 0 : 1) || a.nome.length - b.nome.length);
      return all[0];
    };

    let inferido = null;
    if (msgNoAccent.includes('cort')) inferido = findBest('cort');
    else if (msgNoAccent.includes('barb')) inferido = findBest('barb');
    else if (msgNoAccent.includes('sobrancelh')) inferido = findBest('sobrancelh');

    if (inferido) {
      conv.context.servico_id = inferido.id;
      console.log(`🔍 Serviço inferido: "${msgLower}" → ${inferido.nome} (id: ${inferido.id})`);
    }
  }

  // Extrair hora (só precisa de prof_id — "19h", "17:00" são inequívocos)
  console.log(`🔴 [DEBUG HORA] Mensagem: "${userMessage}"`);
  console.log(`🔴 [DEBUG HORA] prof_id existe? ${!!conv.context.prof_id} (valor: ${conv.context.prof_id})`);
  console.log(`🔴 [DEBUG HORA] hourOnly match:`, userMessage.match(/(?:às|as|horas?)\s+(\d{1,2})/i));
  console.log(`🔴 [DEBUG HORA] timeMatch match:`, userMessage.match(/(\d{1,2})[h:](\d{2})/));
  console.log(`🔴 [DEBUG HORA] horaSimples match:`, userMessage.match(/\b(\d{1,2})h\b/i));

  if (!conv.context.hora && conv.context.prof_id) {
    console.log(`🔴 [DEBUG HORA] Entrou no bloco de extração`);
    const timeMatch = userMessage.match(/(\d{1,2})[h:](\d{2})/);
    if (timeMatch) {
      conv.context.hora = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      console.log(`🔴 [DEBUG HORA] ✅ timeMatch: ${conv.context.hora}`);
    } else {
      const horaSimples = userMessage.match(/\b(\d{1,2})h\b/i);
      if (horaSimples) {
        const h = parseInt(horaSimples[1]);
        console.log(`🔴 [DEBUG HORA] horaSimples h=${h}, range ok? ${h >= 8 && h <= 20}`);
        if (h >= 8 && h <= 20) {
          conv.context.hora = `${String(h).padStart(2, '0')}:00`;
          console.log(`🔴 [DEBUG HORA] ✅ horaSimples: ${conv.context.hora}`);
        }
      } else {
        const hourOnly = userMessage.match(/(?:às|as|horas?)\s+(\d{1,2})/i);
        console.log(`🔴 [DEBUG HORA] hourOnly result:`, hourOnly);
        if (hourOnly) {
          const h = parseInt(hourOnly[1]);
          console.log(`🔴 [DEBUG HORA] hourOnly h=${h}, range ok? ${h >= 8 && h <= 20}`);
          if (h >= 8 && h <= 20) {
            conv.context.hora = `${String(h).padStart(2, '0')}:00`;
            console.log(`🔴 [DEBUG HORA] ✅ hourOnly: ${conv.context.hora}`);
          }
        }
      }
    }
  } else {
    console.log(`🔴 [DEBUG HORA] ❌ NÃO entrou no bloco. hora=${conv.context.hora}, prof_id=${conv.context.prof_id}`);
  }
  console.log(`🔴 [DEBUG HORA] Final: ${conv.context.hora}`);

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
      console.log(`⚠️ Dados faltantes: ${missing.join(', ')} — tentando extrair via IA...`);

      const historioTexto = conv.history
        .filter(h => h.role === 'user')
        .map(h => typeof h.content === 'string' ? h.content : '[imagem]')
        .join(' | ');

      const servicosTexto = services
        .map(s => `${s.nome} (R$${s.preco.toFixed(2)}) [ID: ${s.id}]`)
        .join(', ');

      const profissionaisTexto = professionals
        .map(p => `${p.nome} [ID: ${p.id}]`)
        .join(', ');

      const extractionPrompt = `Extraia dados de agendamento da conversa abaixo.

CONVERSA DO CLIENTE:
${historicoTexto}

DADOS JÁ EXTRAÍDOS (podem estar incompletos):
- Nome: ${conv.context.nome || '?'}
- Barbeiro ID: ${conv.context.prof_id || '?'} (opções: ${profissionaisTexto})
- Serviço ID: ${conv.context.servico_id || '?'} (opções: ${servicosTexto})
- Data: ${conv.context.data || '?'}
- Horário: ${conv.context.hora || '?'}

CAMPOS FALTANDO: ${missing.join(', ')}

INSTRUÇÕES:
- Analise a conversa e preencha APENAS os campos faltantes
- Use IDs dos profissionais/serviços fornecidos
- Data no formato YYYY-MM-DD. Se o cliente NÃO mencionou data, use HOJE: ${new Date().toISOString().split('T')[0]}
- Horário no formato HH:MM (24h)
- Se um campo não puder ser determinado, deixe como null

Responda APENAS com JSON válido, sem formatação extra:
{"nome": ..., "prof_id": ..., "servico_id": ..., "data": ..., "hora": ...}`;

      try {
        const extraction = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é um extrator de dados. Responda APENAS com JSON válido.' },
            { role: 'user', content: extractionPrompt }
          ],
          temperature: 0,
          max_tokens: 200
        });

        const raw = extraction.choices[0].message.content.replace(/```json|```/g, '').trim();
        const extraido = JSON.parse(raw);

        // CORRIGIDO: Permite que a IA re-confirme ou atualize dados já extraídos
        // CORRIGIDO: Permite que a IA re-confirme ou atualize dados já extraídos
        if (extraido.nome) conv.context.nome = extraido.nome;
        if (extraido.prof_id) conv.context.prof_id = extraido.prof_id;
        if (extraido.servico_id) conv.context.servico_id = extraido.servico_id;
        if (extraido.data) conv.context.data = extraido.data;
        if (extraido.hora) conv.context.hora = extraido.hora;

        console.log(`🔍 Extração IA:`, JSON.stringify(extraido));
        console.log(`📋 Contexto APÓS extração IA:`, JSON.stringify(conv.context, null, 2));
      } catch (err) {
        console.error(`⚠️ Falha na extração via IA:`, err.message);
      }

      const missing2 = [];
      if (!conv.context.prof_id) missing2.push('barbeiro');
      if (!conv.context.servico_id) missing2.push('serviço');
      if (!conv.context.data) missing2.push('data');
      if (!conv.context.hora) missing2.push('horário');

      if (missing2.length > 0) {
        const msg = `Faltam informações para confirmar: ${missing2.join(', ')}. Pode me informar?`;
        console.log(`⚠️ Dados ainda faltantes: ${missing2.join(', ')}`);
        await sendWhatsApp(phone, msg);
        return;
      }
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
      
      // Limpar conversa APÓS confirmar
      conversations.delete(phone);
      console.log(`🧹 Conversa de ${phone} limpa após agendamento`);
      
      return;
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      await sendWhatsApp(phone, 'Desculpe, ocorreu um erro ao confirmar. Pode tentar novamente?');
      return;
=======
  if (args.servico_nome && !context.servico_id) {
    const svc = encontrarServico(args.servico_nome, services);
    if (svc) {
      updates.servico_id = svc.id;
      console.log(`✂️ Serviço encontrado: ${svc.nome}`);
    } else {
      console.log(`⚠️ Serviço não encontrado: "${args.servico_nome}"`);
    }
  }
  if (args.data && /^\d{4}-\d{2}-\d{2}$/.test(args.data)) {
    updates.data = args.data;
    console.log(`📅 Data: ${args.data}`);
  }
  if (args.hora) {
    const match = args.hora.match(/^(\d{1,2}):?(\d{2})?$/);
    if (match) {
      const h = String(Math.min(23, parseInt(match[1]))).padStart(2, '0');
      const m = String(match[2] || '00').padStart(2, '0');
      updates.hora = `${h}:${m}`;
      console.log(`🕐 Hora: ${updates.hora}`);
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
    }
  }
  return updates;
}

function montarContextInfo(context, professionals, services, settings, livres = null) {
  let info = `\n\nDATA ATUAL: ${new Date().toISOString().split('T')[0]}\n`;
  info += `\nCONTEXTO ATUAL DO AGENDAMENTO:\n`;
  info += `- Nome titular: ${context.nome || '(NÃO INFORMADO)'}\n`;
  info += `- Para: ${context.para || '(não informado)'}\n`;
  info += `- Dependente: ${context.dependente_nome || '(não informado)'}\n`;
  if (context.prof_id) {
    const p = professionals.find(p => p.id === context.prof_id);
    info += `- Profissional: ${p?.nome || '?'} (id: ${context.prof_id})\n`;
  } else {
    info += `- Profissional: (não escolhido)\n`;
  }
  if (context.servico_id) {
    const s = services.find(s => s.id === context.servico_id);
    info += `- Serviço: ${s?.nome || '?'} - R$ ${s?.preco || '?'}\n`;
  } else {
    info += `- Serviço: (não escolhido)\n`;
  }
  info += `- Data: ${context.data || '(não informada)'}\n`;
  info += `- Horário: ${context.hora || '(não informado)'}\n`;
  info += `\nBARBEIROS DISPONÍVEIS:\n`;
  professionals.forEach((p, i) => info += `${i + 1}. ${p.nome} (${p.categoria})\n`);
  info += `\nSERVIÇOS DISPONÍVEIS:\n`;
  services.forEach((s, i) => info += `${i + 1}. ${s.nome} - ${s.duracao}min - R$ ${Number(s.preco).toFixed(2)}\n`);
  if (livres && livres.length > 0) {
    info += `\nHORÁRIOS LIVRES PARA ${context.data}:\n`;
    livres.forEach((h, i) => info += `${i + 1}. ${h}\n`);
  }
  return info;
}

async function processarMensagem(phone, userMessage) {
  let conv = conversations.get(phone);
  if (!conv) {
    conv = { context: { telefone: phone }, history: [], lastUpdate: Date.now() };
    conversations.set(phone, conv);
  }
  conv.lastUpdate = Date.now();

  const { professionals, services, settings } = await buscarDados();

  let livres = null;
  if (conv.context.prof_id && conv.context.data && settings) {
    const slots = generateSlots(settings.horario_inicio || '08:00', settings.horario_fim || '20:00', settings.slot_minutos || 30);
    const ocupados = await buscarOcupados(conv.context.prof_id, conv.context.data);
    livres = slots.filter(s => !ocupados.includes(s));
  }

  const contextInfo = montarContextInfo(conv.context, professionals, services, settings, livres);
  conv.history.push({ role: 'user', content: userMessage });

  const messages = [{ role: 'system', content: SYSTEM_PROMPT + contextInfo }, ...conv.history];

  console.log(`🤖 Chamando OpenAI...`);

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: FUNCTIONS,
      tool_choice: "auto",
      temperature: 0.5,
      max_tokens: 500
    });
  } catch (err) {
    console.error('❌ Erro OpenAI:', err.message);
    await sendWhatsApp(phone, 'Ops, tive um problema. Pode tentar novamente em instantes? 😅');
    return;
  }

  const assistantMessage = completion.choices[0].message;
  conv.history.push(assistantMessage);

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    let deveConfirmar = false;

    for (const toolCall of assistantMessage.tool_calls) {
      const funcName = toolCall.function.name;
      let args;
      try { args = JSON.parse(toolCall.function.arguments); }
      catch (e) { console.error(`❌ Erro ao parsear args:`, e); continue; }

      console.log(`🔧 Function call: ${funcName}`, args);

      if (funcName === 'extrairDadosAgendamento') {
        const updates = await processarExtracao(args, conv.context, professionals, services);
        Object.assign(conv.context, updates);
        conv.history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true, dados_atualizados: updates })
        });
      } else if (funcName === 'confirmarAgendamento') {
        if (args.confirmado) deveConfirmar = true;
        conv.history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: args.confirmado, message: args.confirmado ? 'Confirmado' : 'Não confirmado' })
        });
      }
    }

    console.log(`📊 Contexto atualizado:`, {
      nome: conv.context.nome || '❌',
      para: conv.context.para || '❌',
      dependente_nome: conv.context.dependente_nome || '❌',
      prof_id: conv.context.prof_id || '❌',
      servico_id: conv.context.servico_id || '❌',
      data: conv.context.data || '❌',
      hora: conv.context.hora || '❌'
    });

    if (deveConfirmar) {
      try {
        console.log('🎯 Tentando criar agendamento...');
        const { appt, pro, svc } = await criarAgendamento(conv.context);
        const dataFormatada = new Date(conv.context.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const mensagemFinal = `✅ *Agendamento confirmado!*\n\n🎉 Seu horário está garantido!\n\n📋 *Detalhes:*\n• ${dataFormatada}\n• Horário: ${conv.context.hora}\n• Serviço: ${svc.nome}\n• Profissional: ${pro.nome}\n• Valor: R$ ${Number(svc.preco).toFixed(2)}\n\n📍 *Barbearia Status*\nCoxim, MS\n\nAté lá! ✂️`;
        await sendWhatsApp(phone, mensagemFinal);
        console.log(`🎉 Agendamento ${appt.id} criado com sucesso!`);
        setTimeout(() => { conversations.delete(phone); console.log(`🧹 Conversa de ${phone} limpa`); }, 5000);
        return;
      } catch (error) {
        console.error('❌ Erro ao criar agendamento:', error.message);
        console.error('   Contexto:', JSON.stringify(conv.context, null, 2));
        let mensagemErro = '😅 Tive um problema ao confirmar. ';
        if (error.message.includes('Dados faltando')) mensagemErro += `Ainda faltam: ${error.message.replace('Dados faltando: ', '')}.`;
        else if (error.message.includes('Profissional não encontrado')) mensagemErro += 'O barbeiro escolhido não está disponível.';
        else if (error.message.includes('Serviço não encontrado')) mensagemErro += 'O serviço escolhido não está disponível.';
        else mensagemErro += 'Pode tentar novamente?';
        await sendWhatsApp(phone, mensagemErro);
        return;
      }
    }

    let livresAtualizados = null;
    if (conv.context.prof_id && conv.context.data && settings) {
      const slots = generateSlots(settings.horario_inicio || '08:00', settings.horario_fim || '20:00', settings.slot_minutos || 30);
      const ocupados = await buscarOcupados(conv.context.prof_id, conv.context.data);
      livresAtualizados = slots.filter(s => !ocupados.includes(s));
    }
    const contextInfoAtualizado = montarContextInfo(conv.context, professionals, services, settings, livresAtualizados);

    try {
      const followUp = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT + contextInfoAtualizado }, ...conv.history],
        temperature: 0.5,
        max_tokens: 400
      });
      const followUpMsg = followUp.choices[0].message.content;
      if (followUpMsg) {
        conv.history.push({ role: 'assistant', content: followUpMsg });
        await sendWhatsApp(phone, followUpMsg);
      }
    } catch (err) {
      console.error('❌ Erro no follow-up:', err.message);
      await sendWhatsApp(phone, 'Posso ajudar com mais alguma informação? 😊');
    }
  } else if (assistantMessage.content) {
    await sendWhatsApp(phone, assistantMessage.content);
  }
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', conversations: conversations.size, timestamp: new Date().toISOString() });
});

<<<<<<< HEAD
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
=======
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    if (payload.event !== 'messages.upsert') return res.json({ ok: true });
    const message = payload.data;
    if (message.key.fromMe || message.key.remoteJid.includes('@g.us')) return res.json({ ok: true });

    const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
<<<<<<< HEAD
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
=======
    let userMessage = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

    if (!userMessage && message.message?.audioMessage) {
      console.log(`🎵 [${phone}]: Áudio recebido`);
      if (message.message.audioMessage.transcript) {
        userMessage = message.message.audioMessage.transcript;
        console.log(`📝 [${phone}]: Transcrição: ${userMessage}`);
      } else {
        await sendWhatsApp(phone, 'Recebi seu áudio! Pode digitar a mensagem para eu processar mais rápido? 😊');
        return res.json({ ok: true });
      }
    }

    if (!userMessage) return res.json({ ok: true });
>>>>>>> f09147e (feat(ai-agent): v3.0 com OpenAI Function Calling para extracao robusta)

    console.log(`\n📱 [${phone}]: ${userMessage}`);
    processarMensagem(phone, userMessage).catch(err => console.error('❌ Erro no processamento:', err));
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🤖 ═══════════════════════════════════════════');
  console.log('🤖  AGENTE DE IA - BARBEARIA STATUS v3.0');
  console.log('🤖 ═══════════════════════════════════════════');
  console.log('');
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📱 Evolution API:', EVOLUTION_URL);
  console.log('📱 Instância:', EVOLUTION_INSTANCE);
  console.log('🤖 Modelo OpenAI:', OPENAI_MODEL);
  console.log('🔧 Function Calling: ATIVO');
  console.log('');
  console.log('✅ Aguardando mensagens...');
  console.log('');
});
