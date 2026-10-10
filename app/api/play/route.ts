import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors';
import { api, readBody } from '@/lib/http';
import { addForMember, dismissNotice, getMe, memberInFamily, memberNeedsPin, pinMatches } from '@/lib/repo';
import { clearPlayerCookie, readActiveMemberId, requireSession, setPlayerCookie } from '@/lib/session';
import { optionalOpId, optionalPin, requireAmount } from '@/lib/validate';

export const POST = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  const action = body.action;

  if (action === 'select') {
    const memberId = requireMemberId(body.memberId);
    if (!memberInFamily(session.familyId, memberId)) {
      throw new HttpError(404, 'That profile was not found.');
    }
    if (memberNeedsPin(session.familyId, memberId)) {
      const pin = optionalPin(body.pin);
      if (!pin) throw new HttpError(401, 'Enter the PIN for this profile.', { pinRequired: true });
      if (!(await pinMatches(session.familyId, memberId, pin))) {
        throw new HttpError(401, 'That PIN does not match.', { pinRequired: true });
      }
    }
    await setPlayerCookie(session.token, memberId);
    return NextResponse.json(getMe(session.familyId, memberId));
  }

  if (action === 'switch') {
    await clearPlayerCookie();
    return NextResponse.json(getMe(session.familyId, null));
  }

  if (action === 'dismiss') {
    const memberId = requireMemberId(body.memberId);
    dismissNotice(session.familyId, memberId);
    const active = await readActiveMemberId(session.token);
    return NextResponse.json(getMe(session.familyId, active));
  }

  if (action === 'add') {
    const cookieMember = await readActiveMemberId(session.token);
    const requested = typeof body.memberId === 'string' ? requireMemberId(body.memberId) : null;
    const active = requested ?? cookieMember;
    if (!active || !memberInFamily(session.familyId, active)) {
      throw new HttpError(400, 'Choose who is reciting first.');
    }
    if (memberNeedsPin(session.familyId, active) && active !== cookieMember) {
      throw new HttpError(401, 'Enter the PIN for this profile.', { pinRequired: true });
    }
    const result = addForMember(session.familyId, active, requireAmount(body.amount), optionalOpId(body.opId));
    return NextResponse.json({
      ...result.me,
      justCompleted: result.justCompleted,
      lifeEarned: result.lifeEarned,
    });
  }

  throw new HttpError(400, 'Unknown action.');
});

function requireMemberId(input: unknown): string {
  if (typeof input !== 'string' || !/^[0-9a-f-]{36}$/i.test(input)) {
    throw new HttpError(400, 'Choose a profile.');
  }
  return input;
}
