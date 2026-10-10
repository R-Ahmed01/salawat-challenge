import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { dbGet } from './db';
import { HttpError } from './errors';

export const SESSION_COOKIE = 'salawat_session';
export const PLAYER_COOKIE = 'salawat_player';

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

type SessionRecord = {
  family_id: string;
  expires_at: string;
};

export type Session = {
  familyId: string;
  token: string;
};

let secretCache: string | null = null;

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Please log in again.');
  return session;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await dbGet<SessionRecord>('SELECT family_id, expires_at FROM sessions WHERE token_hash = ?', [
    hashToken(token),
  ]);
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) return null;
  return { familyId: row.family_id, token };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 30 });
}

export async function setPlayerCookie(token: string, memberId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, sealPlayer(token, memberId), {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearPlayerCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PLAYER_COOKIE);
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PLAYER_COOKIE);
}

export async function readActiveMemberId(token: string): Promise<string | null> {
  const jar = await cookies();
  return openPlayer(token, jar.get(PLAYER_COOKIE)?.value);
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sealPlayer(sessionToken: string, memberId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  const body = `${memberId}.${exp}`;
  const sig = createHmac('sha256', getSecret()).update(`${sessionToken}.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

function openPlayer(sessionToken: string, sealed: string | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split('.');
  if (parts.length !== 3) return null;
  const [memberId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!memberId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = createHmac('sha256', getSecret())
    .update(`${sessionToken}.${memberId}.${expRaw}`)
    .digest('base64url');
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  return memberId;
}

function getSecret(): string {
  if (secretCache) return secretCache;
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) {
    secretCache = fromEnv;
    return secretCache;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production.');
  }
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '.secret');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  secretCache = fs.readFileSync(file, 'utf8').trim();
  return secretCache;
}
