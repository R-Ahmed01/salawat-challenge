import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { createFamily } from '@/lib/repo';
import { isAppClient, setSessionCookie } from '@/lib/session';
import { requireEmail, requireFamilyName, requirePassword, requireTimeZone } from '@/lib/validate';

export const POST = api(async (request) => {
  const body = await readBody(request);
  const token = await createFamily({
    name: requireFamilyName(body.name),
    email: requireEmail(body.email),
    password: requirePassword(body.password),
    timezone: requireTimeZone(body.timezone),
  });
  await setSessionCookie(token);
  return NextResponse.json(isAppClient(request) ? { ok: true, token } : { ok: true });
});
