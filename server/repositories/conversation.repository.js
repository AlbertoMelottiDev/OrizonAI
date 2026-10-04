import { openSqlite } from '../database/sqlite.js';
import { openPostgres, initializePostgres } from '../database/postgres.js';

// Stessa interfaccia per entrambe le modalità: nessun SQL nei controller.
export function createConversationRepository({ databaseUrl, sqliteFilename } = {}) {
  if (databaseUrl) return createPostgresRepository(openPostgres(databaseUrl));
  return createSqliteRepository(openSqlite(sqliteFilename));
}

export function createSqliteRepository(db) {
  const save = db.transaction(({ id, conversationId, role, content, result = null }) => {
    db.prepare('INSERT OR IGNORE INTO conversations (id) VALUES (?)').run(conversationId);
    db.prepare('INSERT INTO messages (id, conversation_id, role, content, result_json) VALUES (?, ?, ?, ?, ?)')
      .run(id, conversationId, role, content, result ? JSON.stringify(result) : null);
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
  });
  return {
    async saveMessage(message) { save(message); },
    async getConversation(id) {
      return db.prepare('SELECT id, role, content, result_json FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid').all(id)
        .map(({ result_json, ...message }) => ({ ...message, result: result_json ? JSON.parse(result_json) : null }));
    },
    async close() { db.close(); },
  };
}

export function createPostgresRepository(pool) {
  let ready;
  async function initialize() {
    ready ??= initializePostgres(pool).catch(error => { ready = undefined; throw error; });
    await ready;
  }
  return {
    async saveMessage({ id, conversationId, role, content, result = null }) {
      await initialize();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [conversationId]);
        await client.query('INSERT INTO messages (id, conversation_id, role, content, result_json) VALUES ($1, $2, $3, $4, $5)', [id, conversationId, role, content, result]);
        await client.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async getConversation(id) {
      await initialize();
      const { rows } = await pool.query('SELECT id, role, content, result_json AS result FROM messages WHERE conversation_id = $1 ORDER BY created_at, id', [id]);
      return rows;
    },
    async close() { await pool.end(); },
  };
}
