import 'dotenv/config';
import { createApp } from './app.js';
import { getConfig } from './config/env.js';
import { createConversationRepository } from './repositories/conversation.repository.js';
import { createChatService } from './services/chat.service.js';
import { createAgentService } from './services/agent.service.js';
import { createOpenAiService } from './services/openai.service.js';
import { createEcofreightService } from './services/ecofreight.service.js';

const config = getConfig();
const repository = createConversationRepository(config);
const agent = createAgentService(createOpenAiService(config), createEcofreightService(config));
const app = createApp({ config, chatService: createChatService(repository, agent) });
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Orizon API in ascolto sulla porta ${config.port}`);
});

function shutdown() {
  server.close(async () => { await repository.close(); });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
