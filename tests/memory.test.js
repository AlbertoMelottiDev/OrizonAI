import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createConversationRepository, createPostgresRepository } from '../server/repositories/conversation.repository.js';

test('SQLite recupera messaggi e risultati dopo chiusura e riapertura', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'orizon-test-'));
  const config = { sqliteFilename: path.join(directory, 'memory.db') };
  let repo = createConversationRepository(config);
  try {
    await repo.saveMessage({ id: 'one', conversationId: 'conversation-one', role: 'user', content: 'Roma Parigi' });
    await repo.saveMessage({ id: 'two', conversationId: 'conversation-one', role: 'assistant', content: 'Stima', result: { co2Kg: 10 } });
    await repo.close();
    repo = createConversationRepository(config);
    const history = await repo.getConversation('conversation-one');
    assert.deepEqual(history.map(m => m.id), ['one', 'two']);
    assert.equal(history[1].result.co2Kg, 10);
    assert.deepEqual(await repo.getConversation('other-conversation'), []);
  } finally {
    await repo.close();
    await rm(directory, { recursive: true });
  }
});

test('Postgres: rollback e rilascio connessione se il salvataggio fallisce', async () => {
  const commands = [];
  let released = false;
  const client = {
    async query(sql) {
      commands.push(sql);
      if (sql.startsWith('INSERT INTO messages')) throw new Error('database-unavailable');
    },
    release() { released = true; },
  };
  const repo = createPostgresRepository({
    async query() {},
    async connect() { return client; },
  });
  await assert.rejects(repo.saveMessage({ id: 'id', conversationId: 'chat', role: 'user', content: 'test' }));
  assert.equal(commands[0], 'BEGIN');
  assert.equal(commands.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});

test('Postgres: errore inizializzazione temporaneo non blocca i tentativi successivi', async () => {
  let attempt = 0;
  const repo = createPostgresRepository({
    async query(sql, params) {
      if (!params && attempt++ === 0) throw new Error('temporary');
      return { rows: [] };
    },
  });
  await assert.rejects(repo.getConversation('chat'));
  assert.deepEqual(await repo.getConversation('chat'), []);
});
