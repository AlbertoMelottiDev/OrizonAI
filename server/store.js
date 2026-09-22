import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dataDirectory = path.resolve('data');
fs.mkdirSync(dataDirectory, { recursive: true });
const db = new Database(path.join(dataDirectory, 'orizon.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
  );
`);

const { Pool } = pg;
const usePostgres = Boolean(process.env.DATABASE_URL);
const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
let postgresReady;

async function ensurePostgres() {
  if (!usePostgres) return;
  if (!postgresReady) {
    postgresReady = pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        result_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
    `);
  }
  await postgresReady;
}

export async function saveMessage({ id, conversationId, role, content, result = null }) {
  if (usePostgres) {
    await ensurePostgres();
    await pool.query('INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [conversationId]);
    await pool.query('INSERT INTO messages (id, conversation_id, role, content, result_json) VALUES ($1, $2, $3, $4, $5)', [id, conversationId, role, content, result]);
    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
    return;
  }
  db.prepare('INSERT OR IGNORE INTO conversations (id) VALUES (?)').run(conversationId);
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, result_json) VALUES (?, ?, ?, ?, ?)')
    .run(id, conversationId, role, content, result ? JSON.stringify(result) : null);
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
}
export async function getConversation(conversationId) {
  if (usePostgres) {
    await ensurePostgres();
    const { rows } = await pool.query('SELECT id, role, content, result_json AS result FROM messages WHERE conversation_id = $1 ORDER BY created_at, id', [conversationId]);
    return rows;
  }
  return db.prepare('SELECT id, role, content, result_json FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid').all(conversationId)
    .map(message => ({ ...message, result: message.result_json ? JSON.parse(message.result_json) : null, result_json: undefined }));
}
