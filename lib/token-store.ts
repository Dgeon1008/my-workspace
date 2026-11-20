import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TokenMessage } from './chatgpt-import.ts';
import type { TokenDay, TokenSummary, AccountSnapshot } from './token-activity.ts';

export function createTokenStore(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS token_messages (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, tokens INTEGER NOT NULL CHECK(tokens >= 0),
      role TEXT NOT NULL CHECK(role IN ('user','assistant'))
    );
    CREATE INDEX IF NOT EXISTS token_messages_day ON token_messages(day);
    CREATE TABLE IF NOT EXISTS token_import_meta (id INTEGER PRIMARY KEY CHECK(id=1), imported_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS account_token_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
  `);
  return {
    accountSnapshot(): AccountSnapshot | null {
      const row = db.prepare('SELECT payload FROM account_token_snapshot WHERE id=1').get() as { payload: string } | undefined;
      return row ? JSON.parse(row.payload) as AccountSnapshot : null;
    },
    saveAccountSnapshot(snapshot: AccountSnapshot) {
      // Replace the complete official snapshot atomically; never add repeated totals.
      db.prepare('INSERT INTO account_token_snapshot VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(snapshot));
    },
    summary(): TokenSummary {
      const days = db.prepare('SELECT day AS date,SUM(tokens) AS tokens,COUNT(*) AS messages FROM token_messages GROUP BY day ORDER BY day').all() as TokenDay[];
      const meta = db.prepare('SELECT imported_at FROM token_import_meta WHERE id=1').get() as { imported_at: string } | undefined;
      return { days, importedAt: meta?.imported_at || null, totalMessages: days.reduce((sum, day) => sum + day.messages, 0) };
    },
    import(messages: TokenMessage[]) {
      const write = db.prepare(`INSERT INTO token_messages(id,day,tokens,role) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET day=excluded.day,tokens=excluded.tokens,role=excluded.role`);
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const message of messages) write.run(message.id, message.date, message.tokens, message.role);
        db.prepare('INSERT INTO token_import_meta VALUES (1,?) ON CONFLICT(id) DO UPDATE SET imported_at=excluded.imported_at').run(new Date().toISOString());
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      console.info('[token-activity] imported message count:', messages.length);
    },
    close: () => db.close(),
  };
}

let store: ReturnType<typeof createTokenStore> | undefined;
export function tokenStore() {
  return store ??= createTokenStore(resolve(process.env.WORKSPACE_DB_PATH || './data/workspace.sqlite'));
}
