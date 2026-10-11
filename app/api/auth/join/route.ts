import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors';
import { api, readBody } from '@/lib/http';
import { joinFamily } from '@/lib/repo';
import { isAppClient, setSessionCookie } from '@/lib/session';
import { requireJoinCode } from '@/lib/validate';

const attempts = new Map<string, { count: number; reset: number }>();

export const POST = api(async (request) => {
  const body = await readBody(request);
  const code = requireJoinCode(body.code);
  if (limited(code)) throw new HttpError(429, 'Too many tries. Wait a few minutes and try again.');

  const token = await joinFamily(code);
  if (!token) throw new HttpError(404, 'That code does not match a group.');

  attempts.delete(code);
  await setSessionCookie(token);
  return NextResponse.json(isAppClient(request) ? { ok: true, token } : { ok: true });
});

function limited(code: string): boolean {
  const now = Date.now();
  const bucket = attempts.get(code);
  if (!bucket || bucket.reset < now) {
    attempts.set(code, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 8;
}
