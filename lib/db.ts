import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const globalForDb = globalThis as unknown as { salawatDb?: DatabaseSync; salawatPlayOps?: boolean };

export function getDb(): DatabaseSync {
  if (!globalForDb.salawatDb) {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, 'salawat.db'));
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 3000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS families (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        timezone TEXT NOT NULL,
        daily_goal INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        pin_hash TEXT,
        lives INTEGER NOT NULL,
        streak INTEGER NOT NULL,
        best_streak INTEGER NOT NULL,
        life_progress INTEGER NOT NULL,
        streak_anchor TEXT,
        processed_through TEXT,
        started INTEGER NOT NULL,
        total_salawat INTEGER NOT NULL,
        pending_notice TEXT,
        created_on TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS days (
        member_id TEXT NOT NULL,
        date TEXT NOT NULL,
        count INTEGER NOT NULL,
        goal INTEGER NOT NULL,
        completed INTEGER NOT NULL,
        PRIMARY KEY (member_id, date),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);
    globalForDb.salawatDb = db;
  }
  ensurePlayOps(globalForDb.salawatDb);
  return globalForDb.salawatDb;
}

function ensurePlayOps(db: DatabaseSync) {
  if (globalForDb.salawatPlayOps) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_ops (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  globalForDb.salawatPlayOps = true;
}

export function withTx<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // The transaction is already closed.
    }
    throw error;
  }
}
