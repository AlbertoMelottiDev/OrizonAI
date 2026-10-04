import { AppError } from '../errors/AppError.js';

export function createOpenAiService(config, fetchImpl = fetch) {
  return {
    async complete(messages, tools, toolChoice = 'auto') {
      if (!config.openaiKey) throw new AppError('Servizio AI non configurato');
      try {
        const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.openaiModel, temperature: 0.2, messages, tools,
            tool_choice: toolChoice, parallel_tool_calls: false,
          }),
        });
        if (!response.ok) throw new Error('provider_error');
        const data = await response.json();
        const message = data.choices?.[0]?.message;
        if (!message || (!message.tool_calls?.length && !message.content?.trim())) throw new Error('empty_response');
        return message;
      } catch {
        throw new AppError('Il servizio AI non è disponibile. Riprova più tardi.');
      }
    },
  };
}
