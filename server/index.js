import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer } from './agent.js';
import { getConversation, saveMessage } from './store.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiConfigured: Boolean(process.env.OPENAI_API_KEY), ecofreightConfigured: Boolean(process.env.ECOFREIGHT_API_KEY) }));
app.get('/api/conversations/:conversationId', async (req, res, next) => {
  try { res.json(await getConversation(req.params.conversationId)); } catch (error) { next(error); }
});
app.post('/api/chat', async (req, res) => {
  const { conversationId, message } = req.body || {};
  if (typeof conversationId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(conversationId)) return res.status(400).json({ error: 'Identificativo conversazione non valido.' });
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) return res.status(400).json({ error: 'Scrivi un messaggio tra 1 e 4000 caratteri.' });
  const userMessage = { id: crypto.randomUUID(), conversationId, role: 'user', content: message.trim() };
  await saveMessage(userMessage);
  try {
    const assistantMessage = await answer(await getConversation(conversationId));
    await saveMessage({ ...assistantMessage, conversationId });
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('chat_error', error.message);
    res.status(503).json({ error: error.message });
  }
});

app.use(express.static(path.join(rootDirectory, 'dist')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(rootDirectory, 'dist', 'index.html')));
app.listen(port, '0.0.0.0', () => console.log(`Orizon API in ascolto su http://localhost:${port}`));
