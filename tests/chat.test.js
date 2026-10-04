import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { createChatService } from '../server/services/chat.service.js';
import { createAgentService } from '../server/services/agent.service.js';
import { createOpenAiService } from '../server/services/openai.service.js';
import { createEcofreightService } from '../server/services/ecofreight.service.js';
import { createConversationRepository } from '../server/repositories/conversation.repository.js';

const config = { openaiKey: 'test', ecofreightKey: 'test', openaiModel: 'test' };
const conversationId = 'test-conversation';
const travel = { transport_mode: 'air', origin: 'Milano', destination: 'Tokyo', weight_kg: 20 };
const call = (args, name = 'calculate_travel_emissions') => ({
  role: 'assistant', content: null,
  tool_calls: [{ id: 'tool-1', type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});

async function fixture(t, replies, provider = () => Response.json({ emissions: { wtw: 12.5 } })) {
  const requests = [];
  const openai = createOpenAiService(config, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: replies.shift() }] });
  });
  const ecoRequests = [];
  const ecofreight = createEcofreightService(config, async (url, options) => {
    ecoRequests.push(JSON.parse(options.body));
    return provider(url, options);
  });
  const repository = createConversationRepository({ sqliteFilename: ':memory:' });
  const chatService = createChatService(repository, createAgentService(openai, ecofreight));
  const server = createApp({ config, chatService }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await repository.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api`;
  return { url, requests, ecoRequests, send: body => fetch(url + '/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) };
}

test('HTTP: calcolo, recupero cronologia e modifica del solo peso', async t => {
  const f = await fixture(t, [
    call(travel), { role: 'assistant', content: 'Stima di 12,5 kg CO₂e per i bagagli' },
    call({ ...travel, weight_kg: 15 }), { role: 'assistant', content: 'Peso aggiornato a 15 kg' },
  ]);
  const first = await f.send({ conversationId, message: 'Volo da Milano a Tokyo con 20 kg' });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).message.result.co2Kg, 12.5);
  const second = await f.send({ conversationId, message: 'Il bagaglio invece pesa 15 kg' });
  assert.equal((await second.json()).message.result.weightKg, 15);
  const history = await (await fetch(f.url + '/conversations/' + conversationId)).json();
  assert.deepEqual(history.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(f.requests[2].messages.filter(m => m.role === 'user').length, 2);
  assert.equal(f.requests[0].messages[0].role, 'system');
  assert.equal(f.requests[1].tool_choice, 'none');
  assert.equal(f.ecoRequests[1].cargo.weight, 15);
  assert.equal(f.ecoRequests[1].destination.query, 'Tokyo');
});

test('HTTP: richiesta incompleta risponde senza chiamare EcoFreight', async t => {
  const f = await fixture(t, [{ role: 'assistant', content: 'Con quale mezzo viaggi e quanto pesano i bagagli?' }]);
  const response = await f.send({ conversationId, message: 'Da Roma a Parigi' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message.result, null);
  assert.equal(f.ecoRequests.length, 0);
});

test('Zod rifiuta input HTTP non validi prima di contattare i provider', async t => {
  const f = await fixture(t, []);
  for (const body of [
    {}, { conversationId, message: '   ' }, { conversationId, message: 42 },
    { conversationId, message: 'a'.repeat(4001) },
    { conversationId: '../invalid', message: 'ciao' },
    { conversationId, message: 'ciao', role: 'system' },
  ]) assert.equal((await f.send(body)).status, 400);
  assert.equal(f.requests.length, 0);
  assert.equal((await fetch(f.url + '/conversations/short')).status, 400);
  assert.equal((await fetch(f.url + '/missing')).status, 404);
  const malformed = await fetch(f.url + '/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON/);
});

test('parametri del tool non validi e tool sconosciuti non raggiungono EcoFreight', async t => {
  const f = await fixture(t, [
    call({ ...travel, weight_kg: -1 }),
    call(travel, 'unknown_tool'),
    { role: 'assistant', content: 'Quanto pesano i bagagli?' },
  ]);
  assert.equal((await f.send({ conversationId, message: 'Viaggio in aereo' })).status, 200);
  assert.equal(f.ecoRequests.length, 0);
  assert.match(f.requests[1].messages.at(-1).content, /non validi/);
});

test('EcoFreight malformato: nessuna card e nessuna emissione inventata', async t => {
  const f = await fixture(t, [call(travel)], () => Response.json({ emissions: {} }));
  const response = await f.send({ conversationId, message: 'Volo Milano Tokyo 20 kg' });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /stima valida/);
  assert.equal(data.message, undefined);
});

test('errore OpenAI restituisce JSON senza esporre il messaggio del provider', async () => {
  const service = createOpenAiService(config, async () => Response.json({ error: { message: 'secret-provider-detail' } }, { status: 401 }));
  await assert.rejects(service.complete([], []), error =>
    error.status === 503 && !error.message.includes('secret-provider-detail'));
});

test('agente: un cambio mezzo mantiene il nuovo input senza forzare il vecchio', async () => {
  let sent;
  const agent = createAgentService({
    async complete(messages) {
      sent = messages;
      return { role: 'assistant', content: 'Ora consideriamo il treno' };
    },
  }, { async calculate() { assert.fail('Tool non richiesto'); } });
  await agent.answer([
    { role: 'user', content: 'Volo da Milano a Parigi con 20 kg' },
    { role: 'assistant', content: 'Stima per il volo' },
    { role: 'user', content: 'Invece vado in treno' },
  ]);
  assert.equal(sent.filter(m => m.role === 'system').length, 1);
  assert.equal(sent.at(-1).content, 'Invece vado in treno');
});

test('agente: parametri corretti dopo errore Zod consentono il calcolo', async t => {
  const f = await fixture(t, [
    call({ ...travel, weight_kg: '20' }),
    call(travel),
    { role: 'assistant', content: 'Stima completata' },
  ]);
  const response = await f.send({ conversationId, message: 'Milano Tokyo in aereo 20 kg' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message.result.weightKg, 20);
  assert.equal(f.ecoRequests.length, 1);
});

test('EcoFreight: distanza e metodologia provengono dalla risposta del provider', async () => {
  const service = createEcofreightService(config, async () => new Response(JSON.stringify({
    emissions: { wtw: 0.55 }, calculation: { distance: 898.9 },
    methodology: { framework: 'GLEC Framework v3.2' },
  }), { status: 200 }));
  const result = await service.calculate(travel);
  assert.equal(result.co2Kg, 0.55);
  assert.equal(result.distanceKm, 898.9);
  assert.equal(result.methodology, 'EcoFreight · GLEC Framework v3.2');
});

test('agente: il loop si interrompe dopo tre tentativi non validi', async () => {
  let calls = 0;
  const agent = createAgentService({
    async complete() { calls++; return call({}); },
  }, { async calculate() { assert.fail('Argomenti non validi'); } });
  await assert.rejects(agent.answer([{ role: 'user', content: 'test' }]), /completare/);
  assert.equal(calls, 4);
});

test('HTTP: errore database prima della chiamata AI restituisce JSON generico', async t => {
  let aiCalled = false;
  const repository = {
    async saveMessage() { throw new Error('postgresql://private-credentials'); },
  };
  const agent = { async answer() { aiCalled = true; } };
  const server = createApp({ config, chatService: createChatService(repository, agent) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message: 'test' }),
  });
  assert.equal(response.status, 500);
  assert.equal(aiCalled, false);
  assert.ok(!(await response.text()).includes('private-credentials'));
});
