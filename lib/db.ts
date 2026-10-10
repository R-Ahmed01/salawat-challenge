import { createClient, type Client, type InValue, type Transaction } from '@libsql/client/http';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

type SqlArg = string | number | bigint | null | Uint8Array;

type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowsAffected: number;
};

type Executor = {
  execute(sql: string, args: SqlArg[]): Promise<QueryResult>;
};

type Database = {
  local: boolean;
  root: Executor;
  begin(): void;
  commit(): void;
  rollback(): void;
  transaction(): Promise<{
    executor: Executor;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): void;
  }>;
};

const txStore = new AsyncLocalStorage<Executor>();
const globalForDb = globalThis as unknown as { salawatSql?: Promise<Database> };
let localQueue: Promise<unknown> = Promise.resolve();

const SCHEMA = `
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

CREATE TABLE IF NOT EXISTS play_ops (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function getDatabase(): Promise<Database> {
  if (!globalForDb.salawatSql) {
    globalForDb.salawatSql = open().catch((error) => {
      globalForDb.salawatSql = undefined;
      throw error;
    });
  }
  return globalForDb.salawatSql;
}

async function open(): Promise<Database> {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (url) return openRemote(url, process.env.TURSO_AUTH_TOKEN?.trim());
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TURSO_DATABASE_URL is required in production.');
  }
  return openLocal();
}

async function openRemote(url: string, authToken: string | undefined): Promise<Database> {
  const client = createClient({ url, authToken });
  await client.executeMultiple(SCHEMA);
  return {
    local: false,
    root: { execute: (sql, args) => remoteExecute(client, sql, args) },
    begin() {},
    commit() {},
    rollback() {},
    async transaction() {
      const tx = await client.transaction('write');
      return {
        executor: { execute: (sql, args) => remoteExecute(tx, sql, args) },
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
        close: () => tx.close(),
      };
    },
  };
}

async function openLocal(): Promise<Database> {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new DatabaseSync(path.join(dir, 'salawat.db'));
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('PRAGMA busy_timeout = 3000');
  sqlite.exec(SCHEMA);
  const root: Executor = {
    async execute(sql, args) {
      const statement = sqlite.prepare(sql);
      if (/^\s*(select|with)\b/i.test(sql)) {
        const rows = statement.all(...args) as Array<Record<string, unknown>>;
        return { rows, rowsAffected: 0 };
      }
      const result = statement.run(...args);
      return { rows: [], rowsAffected: Number(result.changes) };
    },
  };
  return {
    local: true,
    root,
    begin: () => sqlite.exec('BEGIN IMMEDIATE'),
    commit: () => sqlite.exec('COMMIT'),
    rollback: () => sqlite.exec('ROLLBACK'),
    async transaction() {
      throw new Error('Local transactions use the open connection.');
    },
  };
}

async function remoteExecute(target: Client | Transaction, sql: string, args: SqlArg[]): Promise<QueryResult> {
  const result = await target.execute({ sql, args: args as InValue[] });
  return {
    rows: result.rows as unknown as Array<Record<string, unknown>>,
    rowsAffected: result.rowsAffected,
  };
}

async function executor(): Promise<Executor> {
  return txStore.getStore() ?? (await getDatabase()).root;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = localQueue.then(fn, fn);
  localQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function gate<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDatabase();
  if (!db.local || txStore.getStore()) return fn();
  return enqueue(fn);
}

export async function dbGet<T>(sql: string, args: SqlArg[] = []): Promise<T | undefined> {
  return gate(async () => {
    const result = await (await executor()).execute(sql, args);
    return result.rows[0] as T | undefined;
  });
}

export async function dbAll<T>(sql: string, args: SqlArg[] = []): Promise<T[]> {
  return gate(async () => {
    const result = await (await executor()).execute(sql, args);
    return result.rows as T[];
  });
}

export async function dbRun(sql: string, args: SqlArg[] = []): Promise<{ changes: number }> {
  return gate(async () => {
    const result = await (await executor()).execute(sql, args);
    return { changes: result.rowsAffected };
  });
}

export async function withTx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  const db = await getDatabase();
  if (db.local) {
    return enqueue(async () => {
      db.begin();
      try {
        const result = await txStore.run(db.root, fn);
        db.commit();
        return result;
      } catch (error) {
        try {
          db.rollback();
        } catch {
          // The transaction is already closed.
        }
        throw error;
      }
    });
  }

  const tx = await db.transaction();
  try {
    const result = await txStore.run(tx.executor, fn);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      tx.close();
    }
    throw error;
  } finally {
    tx.close();
  }
}
