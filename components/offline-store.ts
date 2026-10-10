import type { MeResponse } from '@/lib/types';
import type { PendingTap } from '@/lib/offline';

const DB_NAME = 'salawat-local';
const HOUSE_KEY = 'current';

export type HouseRecord = {
  base: MeResponse;
  selectedId: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('house')) db.createObjectStore('house');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withDb<T>(mode: IDBTransactionMode, stores: string[], make: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let value: T;
      const request = make(tx);
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadHouse(): Promise<HouseRecord | null> {
  const record = await withDb<HouseRecord | undefined>('readonly', ['house'], (tx) => tx.objectStore('house').get(HOUSE_KEY));
  return record ?? null;
}

export async function saveHouse(record: HouseRecord): Promise<void> {
  await withDb('readwrite', ['house'], (tx) => tx.objectStore('house').put(record, HOUSE_KEY));
}

export async function listOutbox(): Promise<PendingTap[]> {
  const items = await withDb<PendingTap[]>('readonly', ['outbox'], (tx) => tx.objectStore('outbox').getAll());
  return items.sort((a, b) => a.at - b.at);
}

export async function putOutbox(item: PendingTap): Promise<void> {
  await withDb('readwrite', ['outbox'], (tx) => tx.objectStore('outbox').put(item));
}

export async function deleteOutbox(id: string): Promise<void> {
  await withDb('readwrite', ['outbox'], (tx) => tx.objectStore('outbox').delete(id));
}

export async function clearLocalHouse(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['house', 'outbox'], 'readwrite');
      tx.objectStore('house').clear();
      tx.objectStore('outbox').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
