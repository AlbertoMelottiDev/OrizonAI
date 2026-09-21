import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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

export function saveMessage({ id, conversationId, role, content, result = null }) {
  db.prepare('INSERT OR IGNORE INTO conversations (id) VALUES (?)').run(conversationId);
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, result_json) VALUES (?, ?, ?, ?, ?)')
    .run(id, conversationId, role, content, result ? JSON.stringify(result) : null);
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
}
export function getConversation(conversationId) {
  return db.prepare('SELECT id, role, content, result_json FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid').all(conversationId)
    .map(message => ({ ...message, result: message.result_json ? JSON.parse(message.result_json) : null, result_json: undefined }));
}
