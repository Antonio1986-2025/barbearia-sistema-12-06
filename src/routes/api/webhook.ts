/**
 * Rota API para webhook do WhatsApp
 * Endpoint: POST /api/webhook
 */

import { createFileRoute } from '@tanstack/react-router';
import { webhookHandler } from '@/ai-agent/webhook';

export const Route = createFileRoute('/api/webhook')({
  loader: async ({ request }) => {
    // Esta rota será tratada no servidor
    return { ok: true };
  },
});

// Handler será configurado no server.ts
export { webhookHandler };
