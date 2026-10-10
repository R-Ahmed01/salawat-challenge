import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { createMember, getMe } from '@/lib/repo';
import { readActiveMemberId, requireSession, setPlayerCookie } from '@/lib/session';
import { optionalPin, requireColor, requirePersonName } from '@/lib/validate';

export const POST = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  const memberId = await createMember(session.familyId, {
    name: requirePersonName(body.name),
    color: requireColor(body.color),
    pin: optionalPin(body.pin),
  });

  if (body.enter === true) await setPlayerCookie(session.token, memberId);
  const active = body.enter === true ? memberId : await readActiveMemberId(session.token);
  return NextResponse.json(getMe(session.familyId, active));
});
