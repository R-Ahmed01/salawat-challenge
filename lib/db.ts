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
  household_goal INTEGER NOT NULL DEFAULT 10000,
  household_count INTEGER NOT NULL DEFAULT 0,
  join_code TEXT,
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
  daily_goal INTEGER,
  kids INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS phrases (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  label TEXT NOT NULL,
  arabic TEXT NOT NULL,
  latin TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dedications (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS dedications_round ON dedications (member_id, date, name);

CREATE TABLE IF NOT EXISTS hadiths (
  id TEXT PRIMARY KEY,
  arabic TEXT NOT NULL,
  english TEXT NOT NULL,
  source TEXT NOT NULL
);
`;

const COLUMN_ADDS: { table: string; column: string; sql: string }[] = [
  {
    table: 'families',
    column: 'household_goal',
    sql: 'ALTER TABLE families ADD COLUMN household_goal INTEGER NOT NULL DEFAULT 10000',
  },
  {
    table: 'families',
    column: 'household_count',
    sql: 'ALTER TABLE families ADD COLUMN household_count INTEGER NOT NULL DEFAULT 0',
  },
  { table: 'members', column: 'daily_goal', sql: 'ALTER TABLE members ADD COLUMN daily_goal INTEGER' },
  { table: 'members', column: 'kids', sql: 'ALTER TABLE members ADD COLUMN kids INTEGER NOT NULL DEFAULT 0' },
  { table: 'families', column: 'join_code', sql: 'ALTER TABLE families ADD COLUMN join_code TEXT' },
];

const HOUSEHOLD_BACKFILL = `UPDATE families SET household_count = (
  SELECT COALESCE(SUM(total_salawat), 0) FROM members WHERE members.family_id = families.id
)`;

const HADITHS: { id: string; arabic: string; english: string; source: string }[] = [
  {
    id: 'muslim-ten',
    arabic: 'مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا',
    english: 'Whoever sends one blessing upon me, Allah sends ten blessings upon him.',
    source: 'Sahih Muslim',
  },
  {
    id: 'nasai-degrees',
    arabic: 'مَنْ صَلَّى عَلَيَّ صَلَاةً وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرَ صَلَوَاتٍ، وَحُطَّتْ عَنْهُ عَشْرُ خَطِيئَاتٍ، وَرُفِعَتْ لَهُ عَشْرُ دَرَجَاتٍ',
    english: 'Whoever sends one blessing upon me, Allah blesses him ten times, removes ten of his sins, and raises him ten degrees.',
    source: 'Sunan an-Nasa’i',
  },
  {
    id: 'tirmidhi-closest',
    arabic: 'إِنَّ أَوْلَى النَّاسِ بِي يَوْمَ الْقِيَامَةِ أَكْثَرُهُمْ عَلَيَّ صَلَاةً',
    english: 'The people closest to me on the Day of Resurrection will be those who sent the most blessings upon me.',
    source: 'Jami` at-Tirmidhi',
  },
  {
    id: 'dawud-friday',
    arabic: 'إِنَّ مِنْ أَفْضَلِ أَيَّامِكُمْ يَوْمَ الْجُمُعَةِ، فَأَكْثِرُوا عَلَيَّ مِنَ الصَّلَاةِ فِيهِ، فَإِنَّ صَلَاتَكُمْ مَعْرُوضَةٌ عَلَيَّ',
    english: 'Among the best of your days is Friday, so send many blessings upon me on that day, for your blessings are presented to me.',
    source: 'Sunan Abi Dawud',
  },
  {
    id: 'dawud-reply',
    arabic: 'مَا مِنْ أَحَدٍ يُسَلِّمُ عَلَيَّ إِلَّا رَدَّ اللَّهُ عَلَيَّ رُوحِي حَتَّى أَرُدَّ عَلَيْهِ السَّلَامَ',
    english: 'No one sends peace upon me except that Allah returns my soul to me so that I may return the greeting.',
    source: 'Sunan Abi Dawud',
  },
  {
    id: 'tirmidhi-miser',
    arabic: 'الْبَخِيلُ مَنْ ذُكِرْتُ عِنْدَهُ فَلَمْ يُصَلِّ عَلَيَّ',
    english: 'The miser is the one in whose presence I am mentioned and he does not send blessings upon me.',
    source: 'Jami` at-Tirmidhi',
  },
];

function seedHadiths(run: (row: (typeof HADITHS)[number]) => void): void {
  for (const row of HADITHS) run(row);
}

function migrateLocal(sqlite: {
  prepare(sql: string): { all: (...args: never[]) => unknown; run: (...args: string[]) => unknown };
  exec(sql: string): void;
}): void {
  const names = (table: string) =>
    (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
  const familyColumns = names('families');
  const memberColumns = names('members');
  const present = new Set([...familyColumns, ...memberColumns].map((column) => column));
  let backfill = false;
  for (const add of COLUMN_ADDS) {
    const key = add.column;
    const columns = add.table === 'families' ? familyColumns : memberColumns;
    if (columns.includes(key)) continue;
    sqlite.exec(add.sql);
    if (key === 'household_count') backfill = true;
    present.add(key);
  }
  if (backfill) sqlite.exec(HOUSEHOLD_BACKFILL);
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS families_join_code ON families (join_code)');
  const insert = sqlite.prepare('INSERT OR IGNORE INTO hadiths (id, arabic, english, source) VALUES (?, ?, ?, ?)');
  seedHadiths((row) => insert.run(row.id, row.arabic, row.english, row.source));
}

async function migrateRemote(client: Client): Promise<void> {
  const names = async (table: string) => {
    const result = await client.execute(`PRAGMA table_info(${table})`);
    return result.rows.map((row) => String(row.name));
  };
  const familyColumns = await names('families');
  const memberColumns = await names('members');
  let backfill = false;
  for (const add of COLUMN_ADDS) {
    const columns = add.table === 'families' ? familyColumns : memberColumns;
    if (columns.includes(add.column)) continue;
    await client.execute(add.sql);
    if (add.column === 'household_count') backfill = true;
  }
  if (backfill) await client.execute(HOUSEHOLD_BACKFILL);
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS families_join_code ON families (join_code)');
  for (const row of HADITHS) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO hadiths (id, arabic, english, source) VALUES (?, ?, ?, ?)',
      args: [row.id, row.arabic, row.english, row.source],
    });
  }
}

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
  await migrateRemote(client);
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
  migrateLocal(sqlite);
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
