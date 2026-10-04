import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { chatSchema, conversationParamsSchema } from '../schemas/chat.schema.js';

export function createApiRouter(controller, config) {
  const router = Router();
  router.get('/health', (_req, res) => res.json({
    status: 'ok',
    aiConfigured: Boolean(config.openaiKey),
    ecofreightConfigured: Boolean(config.ecofreightKey),
  }));
  router.post('/chat', validate(chatSchema), controller.sendMessage);
  router.get('/conversations/:conversationId', validate(conversationParamsSchema, 'params'), controller.getConversation);
  return router;
}
