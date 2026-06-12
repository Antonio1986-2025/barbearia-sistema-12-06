/**
 * Agente de IA para WhatsApp - Barbearia Status
 * Realiza agendamentos de forma conversacional via WhatsApp
 */

import OpenAI from 'openai';
import { supabase } from '@/integrations/supabase/client';
import { generateSlots, todayYMD } from '@/lib/format';

// Tipos
interface Professional {
  id: number;
  nome: string;
  categoria: string;
}

interface Service {
  id: string;
  nome: string;
  duracao: number;
  preco: number;
}

interface ConversationContext {
  nome?: string;
  telefone?: string;
  para?: 'mim' | 'filho' | 'amigo';
  dependente_nome?: string;
  prof_id?: number;
  servico_id?: string;
  data?: string;
  hora?: string;
}

interface AgentResponse {
  message: string;
  completed: boolean;
  context: ConversationContext;
  appointmentId?: string;
}

// Cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Sistema prompt do agente
 */
const SYSTEM_PROMPT = `Você é um assistente virtual da Barbearia Status em Coxim, MS.
Sua função é ajudar os clientes a agendar horários de forma natural e amigável.

INFORMAÇÕES DA BARBEARIA:
- Nome: Barbearia Status
- Localização: Coxim, MS
- Desde: 1991
- Especialidade: Cortes masculinos, barbas, e acabamentos profissionais

SEU COMPORTAMENTO:
- Seja amigável, profissional e solícito
- Use linguagem informal mas respeitosa
- Seja breve e objetivo nas respostas
- Confirme os dados antes de finalizar
- Use emojis moderadamente (✂️, 📅, ⏰, ✅)

FLUXO DE AGENDAMENTO:
1. Cumprimente o cliente
2. Pergunte o nome completo
3. Confirme o telefone (WhatsApp)
4. Pergunte para quem é o corte (ele mesmo, filho ou amigo)
5. Se for para outra pessoa, pegue o nome dela
6. Mostre os barbeiros disponíveis e deixe escolher
7. Mostre os serviços disponíveis com preços
8. Mostre as datas disponíveis (próximos 7 dias)
9. Mostre os horários livres do profissional na data escolhida
10. Confirme todos os dados antes de agendar
11. Após confirmação, crie o agendamento

REGRAS IMPORTANTES:
- Sempre confirme os dados antes de finalizar
- Não invente horários - use apenas os disponíveis
- Se não houver horário disponível, sugira outro dia
- Seja empático se o cliente precisar remarcar
- Lembre que enviamos confirmação 30min antes do horário

FORMATO DE RESPOSTA:
- Use quebras de linha para organizar informações
- Liste opções de forma clara (1, 2, 3...)
- Destaque informações importantes com *negrito*
- Use emojis para tornar mais amigável

Quando tiver TODOS os dados necessários, responda com:
AGENDAR_AGORA: {json com todos os dados}`;

/**
 * Busca profissionais ativos
 */
async function getProfessionals(): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('id, nome, categoria')
    .eq('ativo', true)
    .order('ordem');

  if (error) throw error;
  return data as Professional[];
}

/**
 * Busca serviços ativos
 */
async function getServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, nome, duracao, preco')
    .eq('ativo', true)
    .order('ordem');

  if (error) throw error;
  return data as Service[];
}

/**
 * Busca configurações da barbearia
 */
async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Busca horários ocupados para um profissional em uma data
 */
async function getOccupiedSlots(profId: number, date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('hora')
    .eq('prof_id', profId)
    .eq('data', date)
    .neq('status', 'cancelado');

  if (error) throw error;
  return (data || []).map((r: any) => r.hora.slice(0, 5));
}

/**
 * Cria um agendamento
 */
async function createAppointment(context: ConversationContext): Promise<string> {
  // Validar dados
  if (!context.nome || !context.telefone || !context.prof_id || 
      !context.servico_id || !context.data || !context.hora) {
    throw new Error('Dados incompletos para criar agendamento');
  }

  const cleanPhone = context.telefone.replace(/\D/g, '');

  // Buscar dados do profissional e serviço
  const { data: pro } = await supabase
    .from('professionals')
    .select('id, nome')
    .eq('id', context.prof_id)
    .single();

  const { data: svc } = await supabase
    .from('services')
    .select('id, nome, duracao, preco')
    .eq('id', context.servico_id)
    .single();

  if (!pro || !svc) throw new Error('Profissional ou serviço não encontrado');

  // Montar nome do cliente final
  const clienteFinal = context.para === 'mim'
    ? context.nome.trim()
    : `${context.nome.trim()} · ${context.dependente_nome?.trim()}`;

  // 1. Cadastrar/atualizar cliente (UPSERT)
  await supabase.from('clients').upsert(
    {
      nome: context.nome.trim(),
      tel: cleanPhone,
      visitas: 0,
      total_gasto: 0
    },
    {
      onConflict: 'tel',
      ignoreDuplicates: false
    }
  );

  // 2. Criar agendamento
  const { data: appt, error: apptError } = await supabase
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

  if (apptError) throw apptError;

  // 3. Abrir comanda automaticamente
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

  return appt.id;
}

/**
 * Processa mensagem do usuário e retorna resposta do agente
 */
export async function processMessage(
  userMessage: string,
  context: ConversationContext = {},
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<AgentResponse> {
  try {
    // Buscar dados necessários
    const [professionals, services, settings] = await Promise.all([
      getProfessionals(),
      getServices(),
      getSettings()
    ]);

    // Montar contexto adicional para o agente
    let contextInfo = '\n\nCONTEXTO ATUAL DA CONVERSA:\n';
    if (context.nome) contextInfo += `- Nome: ${context.nome}\n`;
    if (context.telefone) contextInfo += `- Telefone: ${context.telefone}\n`;
    if (context.para) contextInfo += `- Para: ${context.para}\n`;
    if (context.dependente_nome) contextInfo += `- Nome do dependente: ${context.dependente_nome}\n`;
    if (context.prof_id) {
      const pro = professionals.find(p => p.id === context.prof_id);
      if (pro) contextInfo += `- Barbeiro escolhido: ${pro.nome}\n`;
    }
    if (context.servico_id) {
      const svc = services.find(s => s.id === context.servico_id);
      if (svc) contextInfo += `- Serviço escolhido: ${svc.nome} (R$ ${svc.preco})\n`;
    }
    if (context.data) contextInfo += `- Data escolhida: ${context.data}\n`;
    if (context.hora) contextInfo += `- Horário escolhido: ${context.hora}\n`;

    // Lista de barbeiros
    contextInfo += '\n\nBARBEIROS DISPONÍVEIS:\n';
    professionals.forEach((p, i) => {
      contextInfo += `${i + 1}. ${p.nome} (${p.categoria}) - ID: ${p.id}\n`;
    });

    // Lista de serviços
    contextInfo += '\n\nSERVIÇOS DISPONÍVEIS:\n';
    services.forEach((s, i) => {
      contextInfo += `${i + 1}. ${s.nome} - ${s.duracao}min - R$ ${s.preco.toFixed(2)} - ID: ${s.id}\n`;
    });

    // Horários disponíveis se já tiver profissional e data
    if (context.prof_id && context.data && settings) {
      const slots = generateSlots(
        settings.horario_inicio,
        settings.horario_fim,
        settings.slot_minutos
      );
      const occupied = await getOccupiedSlots(context.prof_id, context.data);
      const available = slots.filter(s => !occupied.includes(s));

      contextInfo += '\n\nHORÁRIOS DISPONÍVEIS NA DATA ESCOLHIDA:\n';
      if (available.length > 0) {
        available.forEach((h, i) => {
          contextInfo += `${i + 1}. ${h}\n`;
        });
      } else {
        contextInfo += 'Nenhum horário disponível nesta data.\n';
      }
    }

    // Chamar OpenAI
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT + contextInfo },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const assistantMessage = completion.choices[0].message.content || '';

    // Verificar se deve agendar
    if (assistantMessage.includes('AGENDAR_AGORA:')) {
      try {
        const appointmentId = await createAppointment(context);
        
        const finalMessage = `✅ *Agendamento confirmado!*

Seu horário na *Barbearia Status* está garantido! 🎉

📋 *Detalhes:*
• Data: ${formatDate(context.data!)}
• Horário: ${context.hora}
• Serviço: ${services.find(s => s.id === context.servico_id)?.nome}
• Profissional: ${professionals.find(p => p.id === context.prof_id)?.nome}

🔔 *Lembrete:*
Você receberá uma mensagem 30 minutos antes do horário.

📍 *Localização:*
Barbearia Status - Coxim, MS

Até lá! ✂️`;

        return {
          message: finalMessage,
          completed: true,
          context,
          appointmentId
        };
      } catch (error: any) {
        return {
          message: `Desculpe, ocorreu um erro ao confirmar o agendamento: ${error.message}. Pode tentar novamente?`,
          completed: false,
          context
        };
      }
    }

    // Extrair dados da conversa (parsing simples)
    const updatedContext = { ...context };
    
    // Tentar extrair nome
    if (!updatedContext.nome && userMessage.match(/meu nome é|me chamo|sou o|sou a/i)) {
      const match = userMessage.match(/(?:meu nome é|me chamo|sou o|sou a)\s+([A-Za-zÀ-ÿ\s]+)/i);
      if (match) updatedContext.nome = match[1].trim();
    }

    // Tentar extrair escolha de barbeiro
    if (!updatedContext.prof_id) {
      professionals.forEach(p => {
        if (userMessage.toLowerCase().includes(p.nome.toLowerCase())) {
          updatedContext.prof_id = p.id;
        }
      });
    }

    // Tentar extrair escolha de serviço
    if (!updatedContext.servico_id) {
      services.forEach(s => {
        if (userMessage.toLowerCase().includes(s.nome.toLowerCase())) {
          updatedContext.servico_id = s.id;
        }
      });
    }

    return {
      message: assistantMessage.replace(/AGENDAR_AGORA:.*$/s, '').trim(),
      completed: false,
      context: updatedContext
    };

  } catch (error: any) {
    console.error('Erro no agente:', error);
    return {
      message: 'Desculpe, tive um problema técnico. Pode tentar novamente?',
      completed: false,
      context
    };
  }
}

/**
 * Formata data para exibição
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: '2-digit', 
    month: 'long' 
  });
}
