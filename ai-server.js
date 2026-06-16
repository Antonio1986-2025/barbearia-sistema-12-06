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

// Handlers globais — capturam erros nao tratados (logs ASCII p/ Easypanel)
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err?.stack || err);
});

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

const SYSTEM_PROMPT = `Voce e a recepcionista da Barbearia Status (Coxim/MS). Atende pelo WhatsApp de forma RAPIDA e NATURAL.

TOM ULTRA DIRETO:
- Fale como recepcionista de bairro: simpatica, eficiente, sem formalidade
- SEMPRE frases curtas (max 10 palavras por frase)
- Uma pergunta por vez
- Use: "Show!", "Beleza!", "Pra qual dia?", "Pode ser?"
- EVITE: "Otimo! Agora vamos...", "Perfeito! Vamos agendar...", "Posso confirmar assim?"
- Chame pelo primeiro nome assim que souber
- Maximo 1 emoji, se fizer sentido

EXEMPLOS DE MENSAGENS BOAS:
✅ "Show! Qual barbeiro?"
✅ "Pra qual dia?"
✅ "Beleza, confirmo?"
✅ "Hoje 15h com Diogo. Pode ser?"

EXEMPLOS RUINS (NUNCA FACA):
❌ "Otimo! Agora vamos escolher um dos nossos barbeiros disponíveis."
❌ "Perfeito! Vamos agendar o servico para voce."
❌ "Maravilha! So pra confirmar todos os detalhes..."
❌ "Posso confirmar assim?"

SEU OBJETIVO: AGENDAR (mas com flexibilidade total)
IMPORTANTE: Sempre chame "extrairDadosAgendamento" quando o cliente fornecer informacoes (nome, profissional, servico, data, hora). NAO confirme sem extrair os dados antes!
- Voce tem liberdade para conduzir a conversa naturalmente
- NAO ha ordem fixa de perguntas - adapte ao que o cliente ja informou
- Cliente perguntou algo fora do contexto? Responda brevemente e volte ao agendamento
  Ex: "Voces aceitam cartao?" → "Sim! Debito e credito. Voltando: pra qual dia voce quer?"
- Cliente mudou de ideia? Sem problema, ajuste naturalmente
  Ex: "Na verdade, prefiro o Felipe" → "Show, Felipe entao!"
- Use os dados que o cliente JA DEU (nao pergunte de novo)
- Cliente disse tipo de servico? Confirme direto: "corte" → "Corte masculino? R$ 45"
- Cliente deu varios dados juntos? Use todos: "corte com Diogo amanha 15h" → pula 3 perguntas

DADOS NECESSARIOS: nome, profissional, servico, data, horario (e nome do dependente, se for pra outra pessoa).

SITUACOES ESPECIAIS:
- Horario ocupado? "Esse horario ta ocupado. Tenho [hora1], [hora2] ou [hora3] livres. Qual prefere?"
- Cliente indeciso? Sugira: "O mais pedido e o corte masculino com o Diogo"
- Pergunta sobre preco/duracao? Responda e continue: "Corte e R$ 45, 30min. Pra qual dia?"
- Cliente sumiu? Se voltar depois, retome de onde parou: "E ai, conseguiu decidir o dia?"
- Duvida sobre endereco/horarios? Responda e volte: "Rua X, centro. Entao, pra qual dia?"

LISTAS (seja visual e limpo):
- Barbeiros: so nomes, numerados. Ex: "1. Junio  2. Diogo  3. Felipe  4. Luan"
- Servicos: nome, tempo, preco. Ex: "1. Corte Masculino - 30min - R$ 45,00"
- Ao listar, diga: "Qual voce prefere?" ou "Manda o numero"
- Ao receber escolha, confirme curto: "Diogo!" ou "Show, Diogo!"

CANCELAMENTO/REMARCACAO:
- Cliente quer cancelar/trocar? Liste os agendamentos dele
- Confirme ANTES de executar: "Cancelar [detalhes]?"
- Depois: "Pronto, cancelado!" ou "Remarcado pra [nova data]!"

FERRAMENTAS (uso interno, o cliente nao ve):
- Chame "extrairDadosAgendamento" SEMPRE que o cliente fornecer qualquer dado novo (mesmo varios de uma vez).
- Chame "confirmarAgendamento" SOMENTE depois de recapitular TUDO e o cliente confirmar com "sim/pode/confirma".

CONFIRMACAO:
- Resuma em 2 linhas: data/hora, barbeiro, servico, valor
- Pergunte CURTO: "Pode ser?", "Beleza, confirmo?", "Fechou?"
- Confirmado: "✅ Confirmado! [data/hora] com [nome]. Ate la! ✂️"

REGRAS:
- Nao invente precos, horarios ou profissionais. Use so o que esta no contexto fornecido.
- Se o cliente mandar audio ou foto, o conteudo ja vem transcrito/descrito no texto. Trate naturalmente.`;

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
  ,{
    type: "function",
    function: {
      name: "consultarMeusAgendamentos",
      description: "Lista os agendamentos futuros do cliente (deste telefone). Use quando o cliente perguntar sobre seus horarios marcados, ou ANTES de cancelar/remarcar.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "cancelarAgendamento",
      description: "Cancela um agendamento do cliente. Chame apos o cliente confirmar o cancelamento. Se houver mais de um, passe data e/ou hora para identificar qual.",
      parameters: {
        type: "object",
        properties: {
          indice: { type: "integer", description: "Numero do agendamento na lista mostrada ao cliente (1, 2, 3...)" },
          data: { type: "string", description: "Data do agendamento a cancelar (YYYY-MM-DD), alternativa ao indice" },
          hora: { type: "string", description: "Hora do agendamento a cancelar (HH:MM), alternativa ao indice" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remarcarAgendamento",
      description: "Remarca (troca) um agendamento para nova data/horario. Chame apos o cliente confirmar. nova_data e nova_hora sao obrigatorios.",
      parameters: {
        type: "object",
        properties: {
          nova_data: { type: "string", description: "Nova data YYYY-MM-DD" },
          nova_hora: { type: "string", description: "Novo horario HH:MM" },
          indice: { type: "integer", description: "Numero do agendamento na lista mostrada ao cliente (1, 2, 3...)" },
          data: { type: "string", description: "Data atual do agendamento (YYYY-MM-DD), alternativa ao indice" },
          hora: { type: "string", description: "Hora atual do agendamento (HH:MM), alternativa ao indice" }
        }
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

/**
 * Busca histórico de agendamentos do cliente
 */
async function buscarHistoricoCliente(telefone) {
  const cleanPhone = String(telefone).replace(/\D/g, '');
  
  const { data, error } = await supabase
    .from('appointments')
    .select('cliente, servico, prof_id, data, hora, status')
    .eq('tel', cleanPhone)
    .order('data', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    return { agendamentos: [], totalVisitas: 0 };
  }
  
  const total = data?.length || 0;
  console.log(`[historico] Cliente tem ${total} agendamento(s) anterior(es)`);
  
  return {
    agendamentos: data || [],
    totalVisitas: total
  };
}


async function buscarClienteCadastrado(tel) {
  const cleanPhone = String(tel).replace(/\D/g, "");
  const { data } = await supabase
    .from("clients")
    .select("nome, visitas, total_gasto")
    .eq("tel", cleanPhone)
    .maybeSingle();
  return data || null;
}


async function buscarAgendamentosCliente(tel) {
  const cleanPhone = String(tel).replace(/\D/g, "");
  const hoje = hojeBrasilISO();
  const { data } = await supabase
    .from("appointments")
    .select("id, data, hora, servico, prof_id, status, valor, cliente")
    .eq("tel", cleanPhone)
    .gte("data", hoje)
    .neq("status", "cancelado")
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  return data || [];
}

async function cancelarAgendamentoDB(apptId) {
  const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", apptId);
  if (error) throw new Error("Erro ao cancelar: " + error.message);
  return true;
}

async function cancelarComandaDoCliente(clienteNome) {
  if (!clienteNome) return false;
  const { data: cmd } = await supabase
    .from("commands")
    .select("id, numero")
    .eq("cliente_nome", clienteNome)
    .eq("status", "aberta")
    .order("abertura", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cmd) return false;
  // Deleta os itens primeiro (FK constraint)
  await supabase.from("command_items").delete().eq("command_id", cmd.id);
  // Deleta a comanda
  await supabase.from("commands").delete().eq("id", cmd.id);
  console.log("[cancelar] comanda #" + cmd.numero + " DELETADA (cliente: " + clienteNome + ")");
  return true;
}

async function remarcarAgendamentoDB(apptId, novaData, novaHora) {
  const { error } = await supabase.from("appointments").update({ data: novaData, hora: novaHora }).eq("id", apptId);
  if (error) throw new Error("Erro ao remarcar: " + error.message);
  return true;
}

function rotuloAgendamento(a, professionals) {
  const p = professionals.find(x => x.id === a.prof_id);
  const dataFmt = new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return `${dataFmt} as ${a.hora.slice(0, 5)} - ${a.servico} com ${p ? p.nome : "profissional"}`;
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
    // Verifica se ja existe comanda aberta para este cliente (evita duplicata)
    const { data: comandaExistente } = await supabase
      .from('commands')
      .select('id, numero')
      .eq('cliente_nome', clienteFinal)
      .eq('status', 'aberta')
      .gte('abertura', new Date(Date.now() - 10000).toISOString())
      .maybeSingle();
    if (comandaExistente) {
      console.log(`♻️ Comanda #${comandaExistente.numero} ja existe para ${clienteFinal} - reutilizando`);
      return { appt, pro, svc };
    }
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
      context._iaExtraiuProf = true;
      console.log(`ðŸ‘¤ Profissional encontrado: ${pro.nome} (id: ${pro.id})`);
    } else {
      console.log(`âš ï¸ Profissional nÃ£o encontrado: "${args.profissional_nome}"`);
    }
  }
  if (args.servico_nome && !context.servico_id) {
    const svc = encontrarServico(args.servico_nome, services);
    if (svc) {
      updates.servico_id = svc.id;
      context._iaExtraiuSvc = true;
      console.log(`âœ‚ï¸ ServiÃ§o encontrado: ${svc.nome}`);
    } else {
      console.log(`âš ï¸ ServiÃ§o nÃ£o encontrado: "${args.servico_nome}"`);
    }
  }
  if (args.data && !context.data && /^\d{4}-\d{2}-\d{2}$/.test(args.data)) {
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

// Data de hoje no fuso de Coxim/MS (America/Campo_Grande, UTC-4)
function hojeBrasilISO() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date()); // YYYY-MM-DD
}

// Converte termos de data (hoje, amanha, dia da semana, dd/mm, "dia X") em YYYY-MM-DD.
// Retorna null se nao reconhecer. NUNCA interpreta numero isolado (esse e horario/opcao).
function parseDataRelativa(msg) {
  const hoje = hojeBrasilISO();
  const [y, m, d] = hoje.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const iso = (dt) => dt.toISOString().split('T')[0];
  const addDias = (n) => { const dt = new Date(base); dt.setUTCDate(dt.getUTCDate() + n); return iso(dt); };

  if (/depois de amanh[aã]/.test(msg)) return addDias(2);
  if (/\bamanh[aã]\b/.test(msg)) return addDias(1);
  if (/\bhoje\b/.test(msg)) return addDias(0);

  const dias = { domingo: 0, segunda: 1, "terca": 2, "terça": 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, "sábado": 6 };
  for (const nome of Object.keys(dias)) {
    if (msg.includes(nome)) {
      const wd = dias[nome];
      const baseWd = base.getUTCDay();
      let add = (wd - baseWd + 7) % 7;
      if (add === 0) add = 7; // proxima ocorrencia
      return addDias(add);
    }
  }

  const dm = msg.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (dm) {
    const dd = parseInt(dm[1]); const mm = parseInt(dm[2]);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  const diaM = msg.match(/\bdia\s+(\d{1,2})\b/);
  if (diaM) {
    const dd = parseInt(diaM[1]);
    if (dd >= 1 && dd <= 31) {
      let mm = m, yy = y;
      if (dd < d) { mm = m === 12 ? 1 : m + 1; if (m === 12) yy = y + 1; }
      return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}
/**
 * Fallback determinístico: escaneia a mensagem crua por serviço/profissional
 * caso a IA não tenha extraído via function calling.
 * Atualiza o context diretamente.
 * 
 * IMPORTANTE: Só roda se IA não extraiu os dados
 */
function extrairFallback(userMessage, context, professionals, services, historico = null) {
  const msg = userMessage.toLowerCase().trim();
  const numIsolado = /^\d{1,2}$/.test(msg) ? parseInt(msg) : null;

  // PROFISSIONAL — só se ainda não escolhido E IA não extraiu
  if (!context.prof_id && !context._iaExtraiuProf) {
    if (numIsolado && numIsolado >= 1 && numIsolado <= professionals.length) {
      context.prof_id = professionals[numIsolado - 1].id;
      console.log(`👤 [fallback] Profissional por número ${numIsolado}: ${professionals[numIsolado - 1].nome}`);
    } else {
      for (const p of professionals) {
        const nome = p.nome.toLowerCase();
        if (msg.includes(nome) || nome.includes(msg.split(' ')[0])) {
          context.prof_id = p.id;
          console.log(`👤 [fallback] Profissional por nome: ${p.nome}`);
          break;
        }
      }
    }
  }

  // SERVIÇO — só se ainda não escolhido E IA não extraiu
  if (!context.servico_id && !context._iaExtraiuSvc) {
    let melhor = null;
    let razao = '';

    // DETECÇÃO INTELIGENTE DE GÊNERO
    const temMasculino = /\b(masculino|homem|rapaz|menino|garoto|pai|filho)\b/i.test(msg);
    const temFeminino = /\b(feminino|mulher|moça|menina|garota|mãe|filha|esposa)\b/i.test(msg);
    
    // Histórico: se cliente tem agendamentos masculinos anteriores
    const historicoMasculino = historico?.agendamentos?.some(a => 
      /corte masculino|corte simples/i.test(a.servico)
    );
    
    console.log(`[detecção] masculino=${temMasculino} feminino=${temFeminino} histórico_masc=${historicoMasculino}`);

    // Se profissional JÁ escolhido e veio um número isolado, trata como índice de serviço
    if (context.prof_id && numIsolado && numIsolado >= 1 && numIsolado <= services.length) {
      melhor = services[numIsolado - 1];
      razao = `número ${numIsolado}`;
    }

    // Por nome completo do serviço presente na mensagem
    if (!melhor) {
      let melhorLen = 0;
      for (const s of services) {
        const nome = s.nome.toLowerCase();
        if (msg.includes(nome) && nome.length > melhorLen) {
          melhor = s;
          melhorLen = nome.length;
          razao = 'nome completo';
        }
      }
    }

    // Por palavra-chave + detecção de gênero
    if (!melhor) {
      if (msg.includes('corte') && msg.includes('barba')) {
        melhor = services.find(s => /corte e barba/i.test(s.nome));
        razao = 'corte+barba';
      } else if (/\bcorte\b/.test(msg)) {
        // PRIORIZA MASCULINO se:
        // - Cliente disse explicitamente "masculino" OU
        // - Cliente tem histórico masculino OU
        // - NÃO disse "feminino"
        if (temMasculino || historicoMasculino || !temFeminino) {
          melhor = services.find(s => /corte masculino|corte simples/i.test(s.nome));
          razao = temMasculino ? 'palavra masculino' : 
                  historicoMasculino ? 'histórico masculino' : 
                  'padrão masculino';
        } else {
          melhor = services.find(s => /corte feminino/i.test(s.nome));
          razao = 'palavra feminino';
        }
        
        // Fallback: qualquer corte
        if (!melhor) {
          melhor = services.find(s => /corte/i.test(s.nome) && !/barba|sobrancelha/i.test(s.nome))
                || services.find(s => /corte/i.test(s.nome));
          razao = 'corte genérico';
        }
      } else if (/\bbarba\b/.test(msg)) {
        melhor = services.find(s => /^barba/i.test(s.nome));
        razao = 'palavra barba';
      }
    }

    if (melhor) {
      context.servico_id = melhor.id;
      console.log(`✂️ [fallback] Serviço: ${melhor.nome} (razão: ${razao})`);
    }
  }
}

function montarContextInfo(context, professionals, services, settings, livres, agsCliente) {
  // Adicionar informação de histórico se disponível
  let infoHistorico = '';
  if (context._visitas > 0) {
    infoHistorico = `\n\nHISTÓRICO DO CLIENTE: ${context._visitas} visita(s) anterior(es). Cliente já conhece a barbearia.`;
  }
  
  let info = infoHistorico + `\n\nDATA ATUAL: ${hojeBrasilISO()}\n`;
  if (context._cadastrado) {
    info += `\nCLIENTE JA CADASTRADO: ${context._cadastrado} (${context._visitas || 0} visita(s) anteriores). Cumprimente-o pelo primeiro nome de forma calorosa e NAO pergunte o nome de novo. Se o agendamento for para ele mesmo, ja use este nome.\n`;
    if (context._historico) {
      info += `HISTORICO/PREFERENCIAS: Cliente costuma agendar "${context._historico.servicoPreferido}". Se ele pedir algo generico como "corte", ja sugira este servico.\n`;
    }
  } else {
    info += `\nCLIENTE NOVO: ainda nao ha cadastro para este numero. Pergunte o nome de forma simpatica quando precisar.\n`;
  }
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
  professionals.forEach((p, i) => info += `${i + 1}. ${p.nome}\n`);
  info += `\nSERVIÃ‡OS DISPONÃVEIS:\n`;
  services.forEach((s, i) => info += `${i + 1}. ${s.nome} - ${s.duracao}min - R$ ${Number(s.preco).toFixed(2)}\n`);
  if (livres && livres.length > 0) {
    info += `\nHORÃRIOS LIVRES PARA ${context.data}:\n`;
    livres.forEach((h, i) => info += `${i + 1}. ${h}\n`);
  }
  if (agsCliente && agsCliente.length > 0) {
    info += `\nSEUS AGENDAMENTOS ATUAIS (para cancelar/remarcar, o cliente escolhe pelo numero):\n`;
    agsCliente.forEach((a, i) => {
      const p = professionals.find(x => x.id === a.prof_id);
      const df = new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      info += `${i + 1}. ${df} as ${a.hora.slice(0,5)} - ${a.servico} com ${p ? p.nome : "?"}\n`;
    });
  } else if (agsCliente && agsCliente.length === 0) {
    info += `\nO cliente NAO possui agendamentos futuros.\n`;
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

  // Consulta cadastro E historico do cliente (uma vez por conversa)
  if (!conv._clienteChecado) {
    conv._clienteChecado = true;
    try {
      const cli = await buscarClienteCadastrado(phone);
      if (cli && cli.nome) {
        conv.context._cadastrado = cli.nome;
        conv.context._visitas = cli.visitas || 0;
        if (!conv.context.nome) conv.context.nome = cli.nome;
        console.log("[cliente] cadastrado: " + cli.nome + " (" + (cli.visitas || 0) + " visita(s))");
      } else {
        console.log("[cliente] sem cadastro para " + phone);
      }
      // Busca historico de agendamentos
      const hist = await buscarHistoricoCliente(phone);
      if (hist) {
        conv.context._historico = hist;
        console.log("[historico] " + hist.total + " agendamento(s) anterior(es). Preferencia: " + hist.servicoPreferido);
      }
    } catch (e) { console.warn("[cliente] aviso lookup:", e.message); }
  }

  const { professionals, services, settings } = await buscarDados();

  // Buscar histórico do cliente
  const historico = await buscarHistoricoCliente(phone);
  if (!conv.context._cadastrado && historico.totalVisitas > 0) {
    const ultimo = historico.agendamentos[0];
    conv.context._cadastrado = ultimo.cliente;
    conv.context._visitas = historico.totalVisitas;
    console.log(`[cliente] cadastrado: ${ultimo.cliente} (${historico.totalVisitas} visita(s))`);
  }

  let livres = null;
  if (conv.context.prof_id && conv.context.data && settings) {
    const slots = generateSlots(settings.horario_inicio || '08:00', settings.horario_fim || '20:00', settings.slot_minutos || 30);
    const ocupados = await buscarOcupados(conv.context.prof_id, conv.context.data);
    livres = slots.filter(s => !ocupados.includes(s));
  }

  // Detecta intencao de cancelar/remarcar e ja busca os agendamentos do cliente no Supabase
  if (/cancel|remarc|trocar|desmarc|adiar|mudar/i.test(userMessage)) conv._modoGestao = true;
  let agsCliente = conv._modoGestao ? await buscarAgendamentosCliente(phone) : null;
  if (agsCliente) { conv.context._ags = agsCliente; console.log(`[gestao] ${phone}: ${agsCliente.length} agendamento(s) carregado(s)`); }

  const contextInfo = montarContextInfo(conv.context, professionals, services, settings, livres, agsCliente);
  conv.history.push({ role: 'user', content: userMessage });

  // Fallback deterministico: escaneia mensagem crua por servico/profissional
  // MAS: so roda se cliente NAO escolheu por numero (evita sobrescrever escolha correta)
  if (!conv.context.servico_id && !conv.context.prof_id) {
    extrairFallback(userMessage, conv.context, professionals, services, historico);
  }

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
    console.error('[ERRO] OpenAI principal:', err?.message, err?.stack);
    await sendWhatsApp(phone, 'Ops, tive um problema. Pode tentar novamente em instantes? 😅');
    return;
  }

  const assistantMessage = completion.choices[0].message;
  conv.history.push(assistantMessage);

  // Checa se cliente afirmou (antes de processar tools)
  const _afirma = /^(sim|isso|isso mesmo|pode|pode confirmar|pode sim|pode marcar|pode agendar|confirma|confirmar|confirmado|claro|perfeito|ok|okay|fechado|fechou|beleza|positivo|com certeza|aham|uhum)\b/i.test(String(userMessage).trim());
  let deveConfirmar = false; // Pode ser setado por tool confirmarAgendamento OU por confirmacao deterministica
  const houveToolCalls = !!(assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0);
  if (houveToolCalls) {

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
      } else if (funcName === 'consultarMeusAgendamentos') {
        const ags = await buscarAgendamentosCliente(phone);
        const lista = ags.map(a => rotuloAgendamento(a, professionals));
        console.log(`[consultar] ${phone}: ${ags.length} agendamento(s)`);
        conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true, total: ags.length, agendamentos: lista }) });
      } else if (funcName === 'cancelarAgendamento') {
        const ags = await buscarAgendamentosCliente(phone);
        let alvo = null;
        if (args.indice && args.indice >= 1 && args.indice <= ags.length) alvo = ags[args.indice - 1];
        else if (ags.length === 1) alvo = ags[0];
        else if (ags.length > 1) alvo = ags.find(a => (!args.data || a.data === args.data) && (!args.hora || a.hora.slice(0,5) === String(args.hora||"").slice(0,5)));
        if (!alvo) {
          conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, motivo: ags.length === 0 ? "sem_agendamentos" : "precisa_identificar", agendamentos: ags.map((a,i)=>`${i+1}. ${rotuloAgendamento(a, professionals)}`) }) });
        } else {
          try {
            await cancelarAgendamentoDB(alvo.id);
            try { await cancelarComandaDoCliente(alvo.cliente); } catch (ce) { console.warn("[cancelar] aviso comanda:", ce.message); }
            console.log(`[cancelar] ${alvo.id} cancelado`);
            conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true, cancelado: rotuloAgendamento(alvo, professionals) }) });
          } catch (e) {
            conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, erro: e.message }) });
          }
        }
      } else if (funcName === 'remarcarAgendamento') {
        const ags = await buscarAgendamentosCliente(phone);
        let alvo = null;
        if (args.indice && args.indice >= 1 && args.indice <= ags.length) alvo = ags[args.indice - 1];
        else if (ags.length === 1) alvo = ags[0];
        else if (ags.length > 1) alvo = ags.find(a => (!args.data || a.data === args.data) && (!args.hora || a.hora.slice(0,5) === String(args.hora||"").slice(0,5)));
        let novaData = (args.nova_data && /^\d{4}-\d{2}-\d{2}$/.test(args.nova_data)) ? args.nova_data : parseDataRelativa(String(args.nova_data||"").toLowerCase());
        let novaHora = null;
        if (args.nova_hora) { const mh = String(args.nova_hora).match(/^(\d{1,2}):?(\d{2})?$/); if (mh) novaHora = String(Math.min(23, parseInt(mh[1]))).padStart(2,"0") + ":" + (mh[2] || "00").padStart(2,"0"); }
        if (!alvo) {
          conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, motivo: ags.length === 0 ? "sem_agendamentos" : "precisa_identificar", agendamentos: ags.map(a => rotuloAgendamento(a, professionals)) }) });
        } else if (!novaData || !novaHora) {
          conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, motivo: "falta_nova_data_hora" }) });
        } else if ((await buscarOcupados(alvo.prof_id, novaData)).includes(novaHora) && !(alvo.data === novaData && alvo.hora.slice(0,5) === novaHora)) {
          const ocupRemarc = await buscarOcupados(alvo.prof_id, novaData);
          const livresRemarc = generateSlots(settings?.horario_inicio || "08:00", settings?.horario_fim || "20:00", settings?.slot_minutos || 30).filter(h => !ocupRemarc.includes(h));
          conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, motivo: "horario_ocupado", horarios_livres: livresRemarc }) });
        } else {
          try {
            await remarcarAgendamentoDB(alvo.id, novaData, novaHora);
            console.log(`[remarcar] ${alvo.id} -> ${novaData} ${novaHora}`);
            conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true, remarcado: { de: rotuloAgendamento(alvo, professionals), para: novaData + " " + novaHora } }) });
          } catch (e) {
            conv.history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: false, erro: e.message }) });
          }
        }
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
  }

  // CONFIRMACAO DETERMINISTICA: Agora que tools processaram, checa se deve confirmar
  const _ctxC = conv.context;
  const _temTudo = !!(_ctxC.nome && _ctxC.prof_id && _ctxC.servico_id && _ctxC.data && _ctxC.hora);
  if (!deveConfirmar) deveConfirmar = _temTudo && _afirma && !conv._modoGestao; // So seta se tool nao setou antes
  console.log(`[DEBUG CONF FINAL] _temTudo=${_temTudo} _afirma=${_afirma}`);
  console.log(`[DEBUG CTX FINAL] nome=${!!_ctxC.nome} prof=${_ctxC.prof_id} svc=${_ctxC.servico_id} data=${_ctxC.data} hora=${_ctxC.hora}`);
  if (deveConfirmar) console.log("[confirmacao] DETERMINISTICA ATIVADA: criando agendamento");

    if (deveConfirmar) {
      try {
        console.log('ðŸŽ¯ Tentando criar agendamento...');
        const { appt, pro, svc } = await criarAgendamento(conv.context);
        const dataFormatada = new Date(conv.context.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const mensagemFinal = `✅ *Agendamento confirmado!*\n\n🎉 Seu horário está garantido!\n\n📋 *Detalhes:*\n• ${dataFormatada}\n• Horário: ${conv.context.hora}\n• Serviço: ${svc.nome}\n• Profissional: ${pro.nome}\n• Valor: R$ ${Number(svc.preco).toFixed(2)}\n\n📍 *Barbearia Status*\nCoxim, MS\n\nAté lá! ✂️`;
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

  if (houveToolCalls) {
    let livresAtualizados = null;
    if (conv.context.prof_id && conv.context.data && settings) {
      const slots = generateSlots(settings.horario_inicio || '08:00', settings.horario_fim || '20:00', settings.slot_minutos || 30);
      const ocupados = await buscarOcupados(conv.context.prof_id, conv.context.data);
      livresAtualizados = slots.filter(s => !ocupados.includes(s));
    }
    const contextInfoAtualizado = montarContextInfo(conv.context, professionals, services, settings, livresAtualizados, conv.context._ags || null);

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
      console.error('[ERRO] follow-up OpenAI:', err?.message, err?.stack);
      await sendWhatsApp(phone, 'Posso ajudar com mais alguma informação? 😊');
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
  const timeout = (ms) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout de transcrição')), ms)
  );

  try {
    console.log('🎙️ Iniciando transcrição com Whisper...');
    const startTime = Date.now();
    
    const { toFile } = await import('openai');
    const buffer = Buffer.from(base64, 'base64');
    const ext = mimetype.includes('mp3') ? 'mp3' : mimetype.includes('mp4') ? 'mp4' : mimetype.includes('wav') ? 'wav' : 'ogg';
    const file = await toFile(buffer, `audio.${ext}`, { type: mimetype || 'audio/ogg' });
    
    // Timeout de 15 segundos
    const transcription = await Promise.race([
      openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'pt',
      }),
      timeout(15000)
    ]);
    
    const elapsed = Date.now() - startTime;
    const text = transcription.text?.trim() || '';
    
    if (text) {
      console.log(`✅ Transcrição completa em ${elapsed}ms: "${text.slice(0, 50)}..."`);
    } else {
      console.warn('⚠️ Transcrição vazia');
    }
    
    return text;
  } catch (err) {
    console.error('❌ Erro na transcrição:', err.message);
    
    if (err.message === 'Timeout de transcrição') {
      console.error('⏱️ Whisper demorou mais de 15 segundos');
    }
    
    return null; // Retorna null ao invés de crashear
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
      console.log(`🎵 [${phone}]: Áudio recebido — transcrevendo...`);
      
      try {
        const midia = await baixarMidiaBase64(message);
        
        if (!midia?.base64) {
          console.error('❌ Falha ao baixar áudio');
          await sendWhatsApp(phone, 'Desculpe, não consegui baixar o áudio. Pode digitar sua mensagem? 😊');
          return res.json({ ok: true });
        }
        
        console.log(`📦 Áudio baixado (${midia.mimetype}), transcrevendo...`);
        userMessage = await transcreverAudio(midia.base64, midia.mimetype);
        
        if (!userMessage) {
          console.error('❌ Transcrição retornou vazio');
          await sendWhatsApp(phone, 'Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊');
          return res.json({ ok: true });
        }
        
        console.log(`📝 [${phone}]: Transcrição OK: "${userMessage.slice(0, 50)}..."`);
      } catch (audioErr) {
        console.error('❌ ERRO CRÍTICO no processamento de áudio:', audioErr.message, audioErr.stack);
        try {
          await sendWhatsApp(phone, 'Desculpe, tive um problema ao processar o áudio. Pode digitar? 😊');
        } catch (sendErr) {
          console.error('❌ Erro ao enviar mensagem de erro:', sendErr);
        }
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
        await sendWhatsApp(phone, 'Recebi sua imagem mas não consegui processá-la 😕 Pode descrever o que deseja?');
        return res.json({ ok: true });
      }
    }

    if (!userMessage) return res.json({ ok: true });

    console.log(`\nðŸ“± [${phone}]: ${userMessage}`);
    processarMensagem(phone, userMessage).catch(err => console.error('[ERRO] processamento:', err?.message, err?.stack));
    res.json({ ok: true });
  } catch (error) {
    console.error('[ERRO] webhook:', error?.message, error?.stack);
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
