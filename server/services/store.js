import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id));`);
  return {
    get(kind, id) { const row = db.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind, id); return row ? JSON.parse(row.value) : null; },
    list(kind) { return db.prepare('SELECT value FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r => JSON.parse(r.value)); },
    put(kind, value) { db.prepare('INSERT INTO records(kind,id,value) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value').run(kind, value.id, JSON.stringify(value)); return value; },
    transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    close() { db.close(); },
  };
}
