import crypto from 'node:crypto';
import { calculateEcofreight } from './ecofreight.js';

export const SYSTEM_PROMPT = `Sei Orizon, l'assistente italiano di un'agenzia che promuove turismo responsabile e rigenerativo.
Il tuo compito è aiutare utenti non tecnici a stimare le emissioni di CO₂e del bagaglio trasportato durante un viaggio.

Raccogli sempre quattro dati: mezzo (aereo, auto/strada, treno o nave), origine, destinazione e peso totale dei bagagli in kg. Una città indicata dall'utente (per esempio “Milano”) è già un'origine valida per EcoFreight: non chiedere un aeroporto, una stazione o un indirizzo più preciso, salvo che l'utente lo chieda espressamente.
Se manca uno o più dati, fai UNA domanda breve e naturale per ottenere solo il dato mancante. Non inventare aeroporti, pesi o tratte.
Quando tutti e quattro i dati sono presenti, chiama obbligatoriamente il tool calculate_travel_emissions. Considera “volo”, “volare”, “aereo” e “aeroplano” sinonimi di air; auto, macchina, auto/strada e autobus sinonimi di road; treno sinonimo di rail; nave e traghetto sinonimi di sea. Non chiedere il mezzo se l'utente ha già scritto uno di questi sinonimi.
Non calcolare mai le emissioni autonomamente e non mostrare mai valori forniti dal tool in modo diverso.
Dopo l'esito del tool, spiega in italiano con tono caldo e conciso: emissioni stimate, mezzo, peso, origine e destinazione. Specifica che è una stima indicativa e non una compensazione. Non promettere sostenibilità assoluta.
Ricorda il contesto della conversazione: se l'utente modifica un solo dettaglio di un viaggio già descritto, conserva gli altri dati e ricalcola. Non chiedere dati già disponibili nella cronologia.
Non fornire consulenza climatica, legale o di viaggio oltre questo perimetro.`;

const tools = [{
  type: 'function',
  function: {
    name: 'calculate_travel_emissions',
    description: 'Calcola le emissioni WTW di CO₂e per la tratta con EcoFreight. Usalo solo dopo aver raccolto tutti i parametri.',
    parameters: { type: 'object', additionalProperties: false, properties: {
      transport_mode: { type: 'string', enum: ['air', 'road', 'rail', 'sea'] },
      origin: { type: 'string', description: 'Città, aeroporto o luogo di partenza' },
      destination: { type: 'string', description: 'Città, aeroporto o luogo di arrivo' },
      weight_kg: { type: 'number', description: 'Peso totale dei bagagli trasportati, in kg' }
    }, required: ['transport_mode', 'origin', 'destination', 'weight_kg']
  }
}}];

async function openAiChat(messages) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurata. Copia .env.example in .env e inserisci la chiave.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', temperature: 0.2, messages, tools, tool_choice: 'auto' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Servizio AI non disponibile (${response.status}).`);
  return data.choices?.[0]?.message;
}

function resolvedTransportHint(history) {
  const text = history.map(message => message.content).join(' ').toLowerCase();
  if (/\b(volo|volare|aereo|aeroplano)\b/.test(text)) return 'air';
  if (/\b(auto|macchina|autobus|pullman|strada)\b/.test(text)) return 'road';
  if (/\btreno\b/.test(text)) return 'rail';
  if (/\b(nave|traghetto)\b/.test(text)) return 'sea';
  return null;
}

/** Executes the LLM tool-call loop. The client never sees provider keys or raw tool calls. */
export async function answer(history) {
  const transportHint = resolvedTransportHint(history);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (transportHint) messages.push({ role: 'system', content: `ISTRUZIONE VINCOLANTE: il mezzo è già noto ed è ${transportHint}. Città di origine e destinazione sono input validi. Non chiedere una conferma del mezzo, un aeroporto o una stazione: se esistono anche origine, destinazione e kg, devi chiamare subito il tool.` });
  messages.push(...history.map(({ role, content }) => ({ role, content })));
  let response = await openAiChat(messages);
  let formattedResult = null;

  if (response.tool_calls?.length) {
    messages.push(response);
    for (const call of response.tool_calls) {
      let toolOutput;
      try {
        const args = JSON.parse(call.function.arguments);
        const calculation = await calculateEcofreight(args);
        formattedResult = {
          co2Kg: calculation.co2Kg, transportMode: ({ air: 'Aereo', road: 'Strada / auto', rail: 'Treno', sea: 'Nave' })[args.transport_mode],
          weightKg: args.weight_kg, origin: args.origin, destination: args.destination,
          distanceKm: calculation.distanceKm, methodology: calculation.methodology
        };
        toolOutput = JSON.stringify(formattedResult);
      } catch (error) {
        toolOutput = JSON.stringify({ error: error.message });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolOutput });
    }
    response = await openAiChat(messages);
  }
  return { id: crypto.randomUUID(), role: 'assistant', content: response?.content || 'Non sono riuscito a formulare una risposta. Riprova.', result: formattedResult };
}
