/**
 * Webhook handler para Evolution API
 * Recebe mensagens do WhatsApp e processa com o agente de IA
 */

import axios from 'axios';
import { processMessage } from './agent';

// Armazenamento temporário de conversas (em produção usar Redis ou banco)
const conversations = new Map<string, {
  context: any;
  history: Array<{ role: string; content: string }>;
  lastUpdate: number;
}>();

// Limpar conversas antigas a cada hora
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [phone, conv] of conversations.entries()) {
    if (now - conv.lastUpdate > ONE_HOUR) {
      conversations.delete(phone);
    }
  }
}, 60 * 60 * 1000);

/**
 * Envia mensagem via Evolution API
 */
async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const evolutionUrl = process.env.EVOLUTION_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!evolutionUrl || !evolutionApiKey || !instance) {
    throw new Error('Credenciais da Evolution API não configuradas');
  }

  try {
    await axios.post(
      `${evolutionUrl}/message/sendText/${instance}`,
      {
        number: phone,
        text: message
      },
      {
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Processa webhook recebido da Evolution API
 */
export async function handleWebhook(payload: any): Promise<void> {
  try {
    // Verificar se é uma mensagem recebida
    if (payload.event !== 'messages.upsert') {
      return;
    }

    const message = payload.data;
    
    // Ignorar mensagens enviadas por nós
    if (message.key.fromMe) {
      return;
    }

    // Ignorar mensagens de grupo
    if (message.key.remoteJid.includes('@g.us')) {
      return;
    }

    // Extrair dados
    const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const userMessage = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';

    if (!userMessage) {
      return;
    }

    console.log(`📱 Mensagem recebida de ${phone}: ${userMessage}`);

    // Recuperar ou criar conversa
    let conversation = conversations.get(phone);
    
    if (!conversation) {
      conversation = {
        context: { telefone: phone },
        history: [],
        lastUpdate: Date.now()
      };
      conversations.set(phone, conversation);
    }

    // Adicionar mensagem do usuário ao histórico
    conversation.history.push({
      role: 'user',
      content: userMessage
    });

    // Processar com o agente
    const response = await processMessage(
      userMessage,
      conversation.context,
      conversation.history
    );

    // Atualizar contexto e histórico
    conversation.context = response.context;
    conversation.history.push({
      role: 'assistant',
      content: response.message
    });
    conversation.lastUpdate = Date.now();

    // Enviar resposta
    await sendWhatsAppMessage(phone, response.message);

    console.log(`✅ Resposta enviada para ${phone}`);

    // Se agendamento foi concluído, limpar conversa
    if (response.completed) {
      console.log(`🎉 Agendamento ${response.appointmentId} criado para ${phone}`);
      
      // Aguardar 5 segundos e limpar conversa
      setTimeout(() => {
        conversations.delete(phone);
        console.log(`🧹 Conversa de ${phone} limpa`);
      }, 5000);
    }

  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
  }
}

/**
 * Handler HTTP para o webhook
 */
export async function webhookHandler(req: any, res: any): Promise<void> {
  try {
    // Verificar método
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Verificar secret (opcional mas recomendado)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
      if (authHeader !== webhookSecret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    // Processar webhook
    await handleWebhook(req.body);

    res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Erro no webhook handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
