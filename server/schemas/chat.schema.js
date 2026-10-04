import { z } from 'zod';

// Conserva il formato già usato dalle conversazioni esistenti.
const conversationId = z.string().regex(/^[a-zA-Z0-9-]{8,100}$/, 'Identificativo conversazione non valido');
export const chatSchema = z.object({
  conversationId,
  message: z.string().max(4000).trim().min(1, 'Scrivi un messaggio'),
}).strict();
export const conversationParamsSchema = z.object({ conversationId }).strict();
