import { NextResponse } from 'next/server';
import { api } from '@/lib/http';
import { logoutFamily } from '@/lib/repo';
import { clearAuthCookies, getSession } from '@/lib/session';

export const POST = api(async () => {
  const session = await getSession();
  if (session) logoutFamily(session.token);
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
});
