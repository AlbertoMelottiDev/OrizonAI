export function createChatController(chatService) {
  return {
    async sendMessage(_req, res) {
      const message = await chatService.sendMessage(res.locals.body);
      res.json({ message });
    },
    async getConversation(_req, res) {
      const messages = await chatService.getConversation(res.locals.params.conversationId);
      res.json(messages);
    },
  };
}
