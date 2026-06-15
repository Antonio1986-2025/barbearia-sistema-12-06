/**
 * Servidor do Agente de IA para WhatsApp - v3.0
 * Usa OpenAI Function Calling para extraÃ§Ã£o robusta de dados
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import { readFileSync } from 'fs';

// ============================================================
// CARREGAMENTO DE VARIÃVEIS DE AMBIENTE
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
        let value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
    console.log('âœ… Arquivo .env carregado');
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.log('â„¹ï¸ Rodando em produÃ§Ã£o - usando variÃ¡veis de ambiente');
    } else {
      console.warn('âš ï¸ Arquivo .env nÃ£o encontrado:', error.message);
    }
  }
}

loadEnv();

// ============================================================
// CONFIGURAÃ‡Ã•ES
// ============================================================
const PORT = process.env.PORT || process.env.AI_PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || process.env.EVOLUTION_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('âŒ Supabase nÃ£o configurado'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('âŒ OpenAI API Key nÃ£o configurada'); process.exit(1); }
if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) { console.error('âŒ Evolution API nÃ£o configurada'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const conversations = new Map();
const processingPhones = new Set();

setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  for (const [phone, conv] of conversations.entries()) {
    if (now - conv.lastUpdate > ONE_HOUR) {
      conversations.delete(phone);
      console.log(`ðŸ§¹ Conversa de ${phone} expirou`);
    }
  }
}, 60 * 60 * 1000);

const SYSTEM_PROMPT = `VocÃª Ã© a recepcionista virtual da Barbearia Status, em Coxim/MS (tradiÃ§Ã£o desde 1991). VocÃª conversa pelo WhatsApp e seu objetivo Ã© AGENDAR o horÃ¡rio do cliente de forma natural, como um atendente humano experiente faria.

COMO VOCÃŠ FALA:
- Tom caloroso, simpÃ¡tico e prÃ³ximo â€” como uma pessoa de verdade, nunca robÃ³tico.
- Linguagem informal brasileira, mas educada. Pode usar "tranquilo", "claro", "perfeito", "show".
- Mensagens curtas e objetivas (WhatsApp). Evite textÃ£o.
- Emojis com moderaÃ§Ã£o (1 por mensagem no mÃ¡ximo, quando fizer sentido).
- Chame o cliente pelo primeiro nome assim que souber.
- FaÃ§a UMA pergunta por vez. NÃ£o despeje vÃ¡rias perguntas juntas.
- Nunca diga que Ã© uma IA ou um robÃ´. VocÃª Ã© da equipe da barbearia.

POSTURA CONSULTIVA (atendimento humano):
- Seja empÃ¡tico: se o cliente parecer com pressa, vÃ¡ direto ao ponto; se estiver perdido, conduza com calma.
- Se o cliente nÃ£o souber o que quer, ofereÃ§a sugestÃµes ("o corte mais pedido Ã© o X").
- Se faltar uma informaÃ§Ã£o, pergunte de forma leve e natural, nÃ£o como formulÃ¡rio.
- Antecipe: se ele escolheu profissional e serviÃ§o, jÃ¡ puxe a data.
- Resolva dÃºvidas e objeÃ§Ãµes com gentileza (preÃ§o, duraÃ§Ã£o, disponibilidade).

DADOS QUE VOCÃŠ PRECISA COLETAR (de forma fluida, nÃ£o como checklist):
- Nome do cliente (titular do telefone)
- Para quem Ã© (ele mesmo ou um dependente; se dependente, o nome)
- Profissional desejado
- ServiÃ§o desejado
- Data e horÃ¡rio

FERRAMENTAS (uso interno, o cliente nÃ£o vÃª):
- Chame "extrairDadosAgendamento" SEMPRE que o cliente fornecer qualquer dado novo (mesmo vÃ¡rios de uma vez).
- Chame "confirmarAgendamento" SOMENTE depois de recapitular tudo E o cliente confirmar com um "sim/pode/confirma".

FECHAMENTO (critÃ©rio de sucesso):
- Antes de finalizar, faÃ§a um resumo claro: profissional, serviÃ§o, valor, data e horÃ¡rio.
- Pergunte algo como "Posso confirmar assim?" e sÃ³ entÃ£o registre.
- Ao confirmar, seja caloroso ("Prontinho, tÃ¡ agendado! ðŸ˜Š").

REGRAS:
- NÃ£o invente preÃ§os, horÃ¡rios ou profissionais â€” use sÃ³ o que estÃ¡ no contexto fornecido.
- Ao listar profissionais ou serviÃ§os, numere as opÃ§Ãµes (1, 2, 3...) para facilitar.
- Se o cliente mandar Ã¡udio ou foto, o conteÃºdo jÃ¡ vem transcrito/descrito no texto â€” trate naturalmente.`;

const FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "extrairDadosAgendamento",
      description: "Extrai dados do agendamento da mensagem do cliente. Use SEMPRE que houver qualquer informaÃ§Ã£o nova.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do CLIENTE TITULAR (dono do telefone)" },
          para: { type: "string", enum: ["mim", "outro"], description: "Quem vai receber: 'mim' ou 'outro' (dependente)" },
          dependente_nome: { type: "string", description: "Nome do dependente (filho, esposa, etc)" },
          profissional_nome: { type: "string", description: "Nome do profissional/barbeiro" },
          servico_nome: { type: "string", description: "Nome do serviÃ§o" },
          data: { type: "string", description: "Data em formato YYYY-MM-DD. Converta 'hoje', 'amanhÃ£', etc." },
          hora: { type: "string", description: "HorÃ¡rio em formato HH:MM (24h). Ex: '13h' â†’ '13:00'" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "confirmarAgendamento",
      description: "Confirma e cria o agendamento. SOMENTE chame apÃ³s cliente confirmar explicitamente.",
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

async function sendWhatsApp(phone, message) {
  try {
    await axios.post(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: phone, text: message },
      { headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
    );
    console.log(`âœ… Mensagem enviada para ${phone}`);
  } catch (error) {
    console.error('âŒ Erro ao enviar WhatsApp:', error.response?.data || error.message);
    throw error;
  }

/**
 * Mostra o status "digitando..." no WhatsApp do cliente (presenÃ§a).
 * Falhas sÃ£o ignoradas â€” Ã© apenas UX.
 */
async function enviarDigitando(phone, durationMs = 1500) {
  try {
    await axios.post(
      `${EVOLUTION_URL}/chat/sendPresence/${EVOLUTION_INSTANCE}`,
      { number: phone, delay: durationMs, presence: 'composing' },
      { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
    );
  } catch {
    // silencioso
  }
}

/**
 * Pausa curta para simular tempo de digitaÃ§Ã£o humano.
 */
function pausa(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
}

async function buscarDados() {
  const [pros, svcs, settings] = await Promise.all([
    supabase.from('professionals').select('id, nome, categoria').eq('ativo', true).order('ordem'),
    supabase.from('services').select('id, nome, duracao, preco').eq('ativo', true).order('ordem'),
    supabase.from('settings').select('*').maybeSingle()
  ]);
  if (pros.error) console.error('âŒ Erro ao buscar profissionais:', pros.error);
  if (svcs.error) console.error('âŒ Erro ao buscar serviÃ§os:', svcs.error);
  console.log(`ðŸ“Š DB: professionals=${pros.data?.length || 0} services=${svcs.data?.length || 0}`);
  return { professionals: pros.data || [], services: svcs.data || [], settings: settings.data };
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
  console.log('ðŸ”¨ [criarAgendamento] Iniciando...');
  console.log('ðŸ“‹ Contexto recebido:', JSON.stringify(context, null, 2));

  const erros = [];
  if (!context.nome) erros.push('nome do cliente');
  if (!context.prof_id) erros.push('profissional');
  if (!context.servico_id) erros.push('serviÃ§o');
  if (!context.data) erros.push('data');
  if (!context.hora) erros.push('horÃ¡rio');
  if (erros.length > 0) throw new Error(`Dados faltando: ${erros.join(', ')}`);

  const cleanPhone = String(context.telefone).replace(/\D/g, '');

  const { data: pro, error: proError } = await supabase.from('professionals').select('*').eq('id', context.prof_id).single();
  if (proError || !pro) throw new Error(`Profissional nÃ£o encontrado (id: ${context.prof_id})`);

  const { data: svc, error: svcError } = await supabase.from('services').select('*').eq('id', context.servico_id).single();
  if (svcError || !svc) throw new Error(`ServiÃ§o nÃ£o encontrado (id: ${context.servico_id})`);

  console.log(`âœ… Profissional: ${pro.nome}, ServiÃ§o: ${svc.nome}`);

  const nomeTitular = String(context.nome || '').trim();
  const nomeDep = String(context.dependente_nome || '').trim();
  const clienteFinal = (context.para === 'outro' && nomeDep) ? `${nomeTitular} Â· ${nomeDep}` : nomeTitular;

  console.log(`ðŸ‘¤ Cliente final: ${clienteFinal}`);

  const { error: clienteError } = await supabase.from('clients').upsert(
    { nome: nomeTitular, tel: cleanPhone, visitas: 0, total_gasto: 0 },
    { onConflict: 'tel', ignoreDuplicates: false }
  );
  if (clienteError) console.warn('âš ï¸ Aviso no upsert de cliente:', clienteError.message);


  // IDEMPOTENCIA: evita duplicar agendamento/comanda se o webhook for reenviado
  const { data: jaExiste } = await supabase
    .from('appointments')
    .select('id')
    .eq('tel', cleanPhone)
    .eq('data', context.data)
    .eq('hora', context.hora)
    .eq('prof_id', pro.id)
    .neq('status', 'cancelado')
    .maybeSingle();
  if (jaExiste) {
    console.log(`â™»ï¸ Agendamento jÃ¡ existe (${jaExiste.id}) â€” ignorando duplicata`);
    return { appt: jaExiste, pro, svc, jaExistia: true };
  }
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
    console.error('âŒ Erro ao inserir agendamento:', apptError);
    throw new Error(`Erro ao criar agendamento: ${apptError?.message || 'desconhecido'}`);
  }

  console.log(`ðŸ“… Agendamento criado: ${appt.id}`);

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
      console.log(`ðŸ’¼ Comanda aberta: #${nextNum}`);
    }
  } catch (cmdErr) {
    console.warn('âš ï¸ Erro ao abrir comanda:', cmdErr.message);
  }

  return { appt, pro, svc };
}

async function processarExtracao(args, context, professionals, services) {
  const updates = {};
  if (args.nome && !context.nome) {
    updates.nome = args.nome.trim();
    console.log(`ðŸ“ Nome extraÃ­do: ${updates.nome}`);
  }
  if (args.para) {
    updates.para = args.para;
    console.log(`ðŸ‘¥ Para: ${args.para}`);
  }
  if (args.dependente_nome) {
    updates.dependente_nome = args.dependente_nome.trim();
    console.log(`ðŸ‘¶ Dependente: ${updates.dependente_nome}`);
  }
  if (args.profissional_nome && !context.prof_id) {
    const pro = encontrarProfissional(args.profissional_nome, professionals);
    if (pro) {
      updates.prof_id = pro.id;
      console.log(`ðŸ‘¤ Profissional encontrado: ${pro.nome} (id: ${pro.id})`);
    } else {
      console.log(`âš ï¸ Profissional nÃ£o encontrado: "${args.profissional_nome}"`);
    }
  }
  if (args.servico_nome && !context.servico_id) {
    const svc = encontrarServico(args.servico_nome, services);
    if (svc) {
      updates.servico_id = svc.id;
      console.log(`âœ‚ï¸ ServiÃ§o encontrado: ${svc.nome}`);
    } else {
      console.log(`âš ï¸ ServiÃ§o nÃ£o encontrado: "${args.servico_nome}"`);
    }
  }
  if (args.data && /^\d{4}-\d{2}-\d{2}$/.test(args.data)) {
    updates.data = args.data;
    console.log(`ðŸ“… Data: ${args.data}`);
  }
  if (args.hora) {
    const match = args.hora.match(/^(\d{1,2}):?(\d{2})?$/);
    if (match) {
      const h = String(Math.min(23, parseInt(match[1]))).padStart(2, '0');
      const m = String(match[2] || '00').padStart(2, '0');
      updates.hora = `${h}:${m}`;
      console.log(`ðŸ• Hora: ${updates.hora}`);
    }
  }
  return updates;
}

function extrairFallback(userMessage, context, professionals, services) {
  const msg = userMessage.toLowerCase().trim();
  const numIsolado = /^\d{1,2}$/.test(msg) ? parseInt(msg) : null;

  // PROFISSIONAL â€” sÃ³ se ainda nÃ£o escolhido
  if (!context.prof_id) {
    if (numIsolado && numIsolado >= 1 && numIsolado <= professionals.length) {
      context.prof_id = professionals[numIsolado - 1].id;
      console.log(`ðŸ‘¤ [fallback] Profissional por nÃºmero ${numIsolado}: ${professionals[numIsolado - 1].nome}`);
    } else {
      for (const p of professionals) {
        const nome = p.nome.toLowerCase();
        if (msg.includes(nome) || nome.includes(msg.split(' ')[0])) {
          context.prof_id = p.id;
          console.log(`ðŸ‘¤ [fallback] Profissional por nome: ${p.nome}`);
          break;
        }
      }
    }
  }

  // SERVIÃ‡O â€” sÃ³ se ainda nÃ£o escolhido
  if (!context.servico_id) {
    let melhor = null;

    if (context.prof_id && numIsolado && numIsolado >= 1 && numIsolado <= services.length) {
      melhor = services[numIsolado - 1];
      console.log(`âœ‚ï¸ [fallback] ServiÃ§o por nÃºmero ${numIsolado}: ${melhor.nome}`);
    }

    if (!melhor) {
      let melhorLen = 0;
      for (const s of services) {
        const nome = s.nome.toLowerCase();
        if (msg.includes(nome) && nome.length > melhorLen) {
          melhor = s;
          melhorLen = nome.length;
        }
      }
    }

    if (!melhor) {
      if (msg.includes('corte') && msg.includes('barba')) {
        melhor = services.find(s => /corte e barba/i.test(s.nome));
      } else if (/\bcorte\b/.test(msg)) {
        melhor = services.find(s => /corte/i.test(s.nome) && !/barba|sobrancelha/i.test(s.nome))
              || services.find(s => /corte/i.test(s.nome));
      } else if (/\bbarba\b/.test(msg)) {
        melhor = services.find(s => /^barba/i.test(s.nome));
      }
    }

    if (melhor) {
      context.servico_id = melhor.id;
      console.log(`âœ‚ï¸ [fallback] ServiÃ§o detectado: ${melhor.nome}`);
    }
  }
}

function montarContextInfo(context, professionals, services, settings, livres) {
  let info = `\n\nDATA ATUAL: ${new Date().toISOString().split('T')[0]}\n`;
  info += `\nCONTEXTO ATUAL DO AGENDAMENTO:\n`;
  info += `- Nome titular: ${context.nome || '(NÃƒO INFORMADO)'}\n`;
  info += `- Para: ${context.para || '(nÃ£o informado)'}\n`;
  info += `- Dependente: ${context.dependente_nome || '(nÃ£o informado)'}\n`;
  if (context.prof_id) {
    const p = professionals.find(p => p.id === context.prof_id);
    info += `- Profissional: ${p?.nome || '?'} (id: ${context.prof_id})\n`;
  } else {
    info += `- Profissional: (nÃ£o escolhido)\n`;
  }
  if (context.servico_id) {
    const s = services.find(s => s.id === context.servico_id);
    info += `- ServiÃ§o: ${s?.nome || '?'} - R$ ${s?.preco || '?'}\n`;
  } else {
    info += `- ServiÃ§o: (nÃ£o escolhido)\n`;
  }
  info += `- Data: ${context.data || '(nÃ£o informada)'}\n`;
  info += `- HorÃ¡rio: ${context.hora || '(nÃ£o informado)'}\n`;
  info += `\nBARBEIROS DISPONÃVEIS:\n`;
  professionals.forEach((p, i) => info += `${i + 1}. ${p.nome} (${p.categoria})\n`);
  info += `\nSERVIÃ‡OS DISPONÃVEIS:\n`;
  services.forEach((s, i) => info += `${i + 1}. ${s.nome} - ${s.duracao}min - R$ ${Number(s.preco).toFixed(2)}\n`);
  if (livres && livres.length > 0) {
    info += `\nHORÃRIOS LIVRES PARA ${context.data}:\n`;
    livres.forEach((h, i) => info += `${i + 1}. ${h}\n`);
  }
  return info;
}

async function processarMensagem(phone, userMessage) {
  if (processingPhones.has(phone)) {
    console.log(`⏳ [${phone}] já em processamento — ignorando duplicata`);
    return;
  }
  processingPhones.add(phone);
  try {
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

  // Fallback deterministico: escaneia mensagem crua por servico/profissional
  extrairFallback(userMessage, conv.context, professionals, services);

  const messages = [{ role: 'system', content: SYSTEM_PROMPT + contextInfo }, ...conv.history];

  console.log(`ðŸ¤– Chamando OpenAI...`);
  // Mostra 'digitando...' enquanto a IA processa
  enviarDigitando(phone, 2000);

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
    console.error('âŒ Erro OpenAI:', err.message);
    await sendWhatsApp(phone, 'Ops, tive um problema. Pode tentar novamente em instantes? ðŸ˜…');
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
      catch (e) { console.error(`âŒ Erro ao parsear args:`, e); continue; }

      console.log(`ðŸ”§ Function call: ${funcName}`, args);

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
          content: JSON.stringify({ success: args.confirmado, message: args.confirmado ? 'Confirmado' : 'NÃ£o confirmado' })
        });
      }
    }

    console.log(`ðŸ“Š Contexto atualizado:`, {
      nome: conv.context.nome || 'âŒ',
      para: conv.context.para || 'âŒ',
      dependente_nome: conv.context.dependente_nome || 'âŒ',
      prof_id: conv.context.prof_id || 'âŒ',
      servico_id: conv.context.servico_id || 'âŒ',
      data: conv.context.data || 'âŒ',
      hora: conv.context.hora || 'âŒ'
    });

    if (deveConfirmar) {
      try {
        console.log('ðŸŽ¯ Tentando criar agendamento...');
        const { appt, pro, svc } = await criarAgendamento(conv.context);
        const dataFormatada = new Date(conv.context.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const mensagemFinal = `âœ… *Agendamento confirmado!*\n\nðŸŽ‰ Seu horÃ¡rio estÃ¡ garantido!\n\nðŸ“‹ *Detalhes:*\nâ€¢ ${dataFormatada}\nâ€¢ HorÃ¡rio: ${conv.context.hora}\nâ€¢ ServiÃ§o: ${svc.nome}\nâ€¢ Profissional: ${pro.nome}\nâ€¢ Valor: R$ ${Number(svc.preco).toFixed(2)}\n\nðŸ“ *Barbearia Status*\nCoxim, MS\n\nAtÃ© lÃ¡! âœ‚ï¸`;
        await sendWhatsApp(phone, mensagemFinal);
        console.log(`ðŸŽ‰ Agendamento ${appt.id} criado com sucesso!`);
        setTimeout(() => { conversations.delete(phone); console.log(`ðŸ§¹ Conversa de ${phone} limpa`); }, 5000);
        return;
      } catch (error) {
        console.error('âŒ Erro ao criar agendamento:', error.message);
        console.error('   Contexto:', JSON.stringify(conv.context, null, 2));
        let mensagemErro = 'ðŸ˜… Tive um problema ao confirmar. ';
        if (error.message.includes('Dados faltando')) mensagemErro += `Ainda faltam: ${error.message.replace('Dados faltando: ', '')}.`;
        else if (error.message.includes('Profissional nÃ£o encontrado')) mensagemErro += 'O barbeiro escolhido nÃ£o estÃ¡ disponÃ­vel.';
        else if (error.message.includes('ServiÃ§o nÃ£o encontrado')) mensagemErro += 'O serviÃ§o escolhido nÃ£o estÃ¡ disponÃ­vel.';
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
      console.error('âŒ Erro no follow-up:', err.message);
      await sendWhatsApp(phone, 'Posso ajudar com mais alguma informaÃ§Ã£o? ðŸ˜Š');
    }
  } else if (assistantMessage.content) {
    await sendWhatsApp(phone, assistantMessage.content);
  }
  } finally {
    processingPhones.delete(phone);
  }
}

// ============================================================
// MÃDIA: Ã¡udio (Whisper) e imagem (GPT-4o vision)
// ============================================================

/**
 * Baixa a mÃ­dia (Ã¡udio/imagem) de uma mensagem via Evolution API,
 * retornando { base64, mimetype }.
 */
async function baixarMidiaBase64(message) {
  try {
    const resp = await axios.post(
      `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
      { message: { key: message.key } },
      { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
    );
    const data = resp.data || {};
    const base64 = data.base64 || data.media || data?.message?.base64;
    const mimetype = data.mimetype || data?.message?.mimetype || '';
    if (!base64) {
      console.warn('âš ï¸ getBase64FromMediaMessage nÃ£o retornou base64:', JSON.stringify(data).slice(0, 200));
      return null;
    }
    return { base64, mimetype };
  } catch (err) {
    console.error('âŒ Erro ao baixar mÃ­dia:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Transcreve Ã¡udio (base64) usando OpenAI Whisper.
 */
async function transcreverAudio(base64, mimetype = 'audio/ogg') {
  try {
    const { toFile } = await import('openai');
    const buffer = Buffer.from(base64, 'base64');
    const ext = mimetype.includes('mp3') ? 'mp3' : mimetype.includes('mp4') ? 'mp4' : mimetype.includes('wav') ? 'wav' : 'ogg';
    const file = await toFile(buffer, `audio.${ext}`, { type: mimetype || 'audio/ogg' });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    });
    return result.text?.trim() || '';
  } catch (err) {
    console.error('âŒ Erro ao transcrever Ã¡udio:', err.message);
    return '';
  }
}

/**
 * Analisa imagem (base64) usando GPT-4o vision e retorna uma descriÃ§Ã£o
 * em texto, Ãºtil para o fluxo de agendamento.
 */
async function analisarImagem(base64, mimetype = 'image/jpeg', caption = '') {
  try {
    const dataUrl = `data:${mimetype || 'image/jpeg'};base64,${base64}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'VocÃª analisa imagens enviadas por clientes de uma barbearia. Descreva de forma objetiva e curta o que vÃª (ex.: estilo de corte/barba desejado, referÃªncia de cabelo). Se houver texto na imagem (ex.: print de horÃ¡rio), transcreva. Responda em portuguÃªs, em 1-3 frases.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: caption ? `Legenda do cliente: "${caption}". Analise a imagem:` : 'Analise esta imagem enviada pelo cliente:' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('âŒ Erro ao analisar imagem:', err.message);
    return '';
  }
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', conversations: conversations.size, timestamp: new Date().toISOString() });
});

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    if (payload.event !== 'messages.upsert') return res.json({ ok: true });
    const message = payload.data;
    if (message.key.fromMe || message.key.remoteJid.includes('@g.us')) return res.json({ ok: true });

    const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
    let userMessage = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

    // ÃUDIO: baixa e transcreve com Whisper
    if (!userMessage && message.message?.audioMessage) {
      console.log(`ðŸŽµ [${phone}]: Ãudio recebido â€” transcrevendo...`);
      const midia = await baixarMidiaBase64(message);
      if (midia?.base64) {
        userMessage = await transcreverAudio(midia.base64, midia.mimetype);
        console.log(`ðŸ“ [${phone}] TranscriÃ§Ã£o: ${userMessage}`);
      }
      if (!userMessage && message.message.audioMessage.transcript) {
        userMessage = message.message.audioMessage.transcript;
      }
      if (!userMessage) {
        await sendWhatsApp(phone, 'NÃ£o consegui entender o Ã¡udio ðŸ˜• Pode escrever ou enviar de novo?');
        return res.json({ ok: true });
      }
    }

    // IMAGEM: baixa e analisa com GPT-4o vision
    if (!userMessage && message.message?.imageMessage) {
      console.log(`ðŸ–¼ï¸ [${phone}]: Imagem recebida â€” analisando...`);
      const caption = message.message.imageMessage.caption || '';
      const midia = await baixarMidiaBase64(message);
      if (midia?.base64) {
        const descricao = await analisarImagem(midia.base64, midia.mimetype, caption);
        console.log(`ðŸ‘ï¸ [${phone}] AnÃ¡lise da imagem: ${descricao}`);
        userMessage = caption
          ? `${caption}\n[Imagem enviada pelo cliente: ${descricao}]`
          : `[O cliente enviou uma imagem: ${descricao}]`;
      }
      if (!userMessage) {
        await sendWhatsApp(phone, 'Recebi sua imagem mas nÃ£o consegui processÃ¡-la ðŸ˜• Pode descrever o que deseja?');
        return res.json({ ok: true });
      }
    }

    if (!userMessage) return res.json({ ok: true });

    console.log(`\nðŸ“± [${phone}]: ${userMessage}`);
    processarMensagem(phone, userMessage).catch(err => console.error('âŒ Erro no processamento:', err));
    res.json({ ok: true });
  } catch (error) {
    console.error('âŒ Erro no webhook:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('ðŸ¤– â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ¤–  AGENTE DE IA - BARBEARIA STATUS v3.0');
  console.log('ðŸ¤– â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('');
  console.log(`âœ… Servidor rodando na porta ${PORT}`);
  console.log(`ðŸ“ Webhook: http://localhost:${PORT}/webhook`);
  console.log(`ðŸ¥ Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('ðŸ“± Evolution API:', EVOLUTION_URL);
  console.log('ðŸ“± InstÃ¢ncia:', EVOLUTION_INSTANCE);
  console.log('ðŸ¤– Modelo OpenAI:', OPENAI_MODEL);
  console.log('ðŸ”§ Function Calling: ATIVO');
  console.log('');
  console.log('âœ… Aguardando mensagens...');
  console.log('');
});
