import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN = 'salawat_token';
const PLAYER = 'salawat_player';

export function defaultServer(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

export async function loadSession(): Promise<{ server: string; token: string | null; playerToken: string | null }> {
  const [token, playerToken] = await Promise.all([read(TOKEN), read(PLAYER)]);
  return { server: defaultServer(), token, playerToken };
}

export async function saveToken(token: string): Promise<void> {
  await write(TOKEN, token);
  await remove(PLAYER);
}

export async function savePlayer(playerToken: string | null): Promise<void> {
  if (playerToken) await write(PLAYER, playerToken);
  else await remove(PLAYER);
}

export async function clearSession(): Promise<void> {
  await Promise.all([remove(TOKEN), remove(PLAYER)]);
}

async function read(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
