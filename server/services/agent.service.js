import { randomUUID } from 'node:crypto';
import { SYSTEM_PROMPT } from '../prompts/system.prompt.js';
import { travelTool } from '../tools/travel.tool.js';
import { travelSchema } from '../schemas/travel.schema.js';
import { AppError } from '../errors/AppError.js';

const labels = { air: 'Aereo', road: 'Strada / auto', rail: 'Treno', sea: 'Nave' };

export function createAgentService(openai, ecofreight) {
  return {
    async answer(history) {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map(({ role, content }) => ({ role, content })),
      ];
      let response = await openai.complete(messages, [travelTool]);
      let result = null;
      // Un numero finito di passaggi permette di correggere parametri non validi.
      for (let turn = 0; response.tool_calls?.length && turn < 3; turn++) {
        messages.push(response);
        for (const call of response.tool_calls) {
          let output;
          const args = parseToolArguments(call);
          if (!args) {
            output = { error: 'Parametri del tool non validi: servono air/road/rail/sea, origine, destinazione e peso numerico positivo.' };
          } else {
            const calculation = await ecofreight.calculate(args);
            result = {
              ...calculation, transportMode: labels[args.transport_mode],
              weightKg: args.weight_kg, origin: args.origin, destination: args.destination,
            };
            output = result;
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
        }
        response = await openai.complete(messages, [travelTool], result || turn === 2 ? 'none' : 'auto');
      }
      if (response.tool_calls?.length || !response.content?.trim()) {
        throw new AppError('Non riesco a completare la richiesta. Riprova.');
      }
      return { id: randomUUID(), role: 'assistant', content: response.content, result };
    },
  };
}

function parseToolArguments(call) {
  if (call.function?.name !== travelTool.function.name) return null;
  try {
    const parsed = travelSchema.safeParse(JSON.parse(call.function.arguments));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
