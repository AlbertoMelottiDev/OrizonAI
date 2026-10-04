import { randomUUID } from 'node:crypto';

export function createChatService(repository, agent) {
  return {
    getConversation: id => repository.getConversation(id),
    async sendMessage({ conversationId, message }) {
      await repository.saveMessage({
        id: randomUUID(), conversationId, role: 'user', content: message,
      });
      const history = await repository.getConversation(conversationId);
      const response = await agent.answer(history);
      await repository.saveMessage({ ...response, conversationId });
      return response;
    },
  };
}
