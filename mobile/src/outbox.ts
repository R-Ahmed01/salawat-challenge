import { documentDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { PendingTap } from './types';

const KEY = 'salawat-outbox';

export async function loadOutbox(): Promise<PendingTap[]> {
  const raw = await readRaw();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as PendingTap[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveOutbox(items: PendingTap[]): Promise<void> {
  const raw = JSON.stringify(items);
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, raw);
    return;
  }
  const uri = fileUri();
  if (!uri) return;
  await writeAsStringAsync(uri, raw);
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  const uri = fileUri();
  if (!uri) return null;
  const info = await getInfoAsync(uri);
  if (!info.exists) return null;
  return readAsStringAsync(uri);
}

function fileUri(): string | null {
  if (!documentDirectory) return null;
  return `${documentDirectory}salawat-outbox.json`;
}
