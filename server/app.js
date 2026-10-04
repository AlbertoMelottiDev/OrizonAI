import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './routes/api.routes.js';
import { createChatController } from './controllers/chat.controller.js';
import { errorHandler } from './middleware/errorHandler.js';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));

export function createApp({ chatService, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', createApiRouter(createChatController(chatService), config));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint non trovato' }));
  app.use(express.static(path.join(rootDirectory, 'dist')));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(rootDirectory, 'dist', 'index.html')));
  app.use(errorHandler);
  return app;
}
