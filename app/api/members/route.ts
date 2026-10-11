import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { createMember, getMe } from '@/lib/repo';
import { isAppClient, issuePlayerToken, readActiveMemberId, requireSession, setPlayerCookie } from '@/lib/session';
import { optionalMemberGoal, optionalPin, requireColor, requirePersonName } from '@/lib/validate';

export const POST = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  const memberId = await createMember(session.familyId, {
    name: requirePersonName(body.name),
    color: requireColor(body.color),
    pin: optionalPin(body.pin),
    dailyGoal: optionalMemberGoal(body.dailyGoal),
    kids: body.kids === true,
  });

  if (body.enter === true) await setPlayerCookie(session.token, memberId);
  const active = body.enter === true ? memberId : await readActiveMemberId(session.token);
  const me = await getMe(session.familyId, active);
  if (body.enter === true && isAppClient(request)) {
    return NextResponse.json({ ...me, playerToken: issuePlayerToken(session.token, memberId) });
  }
  return NextResponse.json(me);
});
