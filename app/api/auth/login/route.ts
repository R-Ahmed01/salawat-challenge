import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors';
import { api, readBody } from '@/lib/http';
import { loginFamily } from '@/lib/repo';
import { isAppClient, setSessionCookie } from '@/lib/session';
import { requireEmail } from '@/lib/validate';

const attempts = new Map<string, { count: number; reset: number }>();

export const POST = api(async (request) => {
  const body = await readBody(request);
  const email = requireEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 128) {
    throw new HttpError(401, 'That email and password do not match.');
  }
  if (limited(email)) throw new HttpError(429, 'Too many tries. Wait a few minutes and try again.');

  const token = await loginFamily(email, password);
  if (!token) throw new HttpError(401, 'That email and password do not match.');

  attempts.delete(email);
  await setSessionCookie(token);
  return NextResponse.json(isAppClient(request) ? { ok: true, token } : { ok: true });
});

function limited(email: string): boolean {
  const now = Date.now();
  const bucket = attempts.get(email);
  if (!bucket || bucket.reset < now) {
    attempts.set(email, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 8;
}
