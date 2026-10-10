import { NextResponse } from 'next/server';
import { api } from '@/lib/http';
import { getMe } from '@/lib/repo';
import { clearPlayerCookie, readActiveMemberId, requireSession } from '@/lib/session';

export const GET = api(async () => {
  const session = await requireSession();
  const requested = await readActiveMemberId(session.token);
  const me = await getMe(session.familyId, requested);
  if (requested && me.activeMemberId !== requested) await clearPlayerCookie();
  return NextResponse.json(me);
});
