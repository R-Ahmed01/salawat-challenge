import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { changePassword, getMe, updateFamily } from '@/lib/repo';
import { readActiveMemberId, requireSession } from '@/lib/session';
import { requireFamilyName, requireGoal, requirePassword, requireTimeZone } from '@/lib/validate';

export const PATCH = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  const patch: { name?: string; timezone?: string; dailyGoal?: number } = {};

  if ('name' in body) patch.name = requireFamilyName(body.name);
  if ('timezone' in body) patch.timezone = requireTimeZone(body.timezone);
  if ('dailyGoal' in body) patch.dailyGoal = requireGoal(body.dailyGoal);

  const changingPassword = 'newPassword' in body || 'currentPassword' in body;
  if (!patch.name && !patch.timezone && patch.dailyGoal == null && !changingPassword) {
    throw new HttpError(400, 'Nothing to update.');
  }

  if (changingPassword) {
    await changePassword(
      session.familyId,
      requirePassword(body.currentPassword),
      requirePassword(body.newPassword),
    );
  }
  if (patch.name || patch.timezone || patch.dailyGoal != null) {
    updateFamily(session.familyId, patch);
  }

  const active = await readActiveMemberId(session.token);
  return NextResponse.json(getMe(session.familyId, active));
});
