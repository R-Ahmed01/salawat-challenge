import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { changePassword, getMe, updateFamily } from '@/lib/repo';
import { readActiveMemberId, requireSession } from '@/lib/session';
import { requireFamilyName, requireGoal, requireHouseholdGoal, requirePassword, requireTimeZone } from '@/lib/validate';

export const PATCH = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  const patch: {
    name?: string;
    timezone?: string;
    dailyGoal?: number;
    householdGoal?: number;
    resetHousehold?: boolean;
  } = {};

  if ('name' in body) patch.name = requireFamilyName(body.name);
  if ('timezone' in body) patch.timezone = requireTimeZone(body.timezone);
  if ('dailyGoal' in body) patch.dailyGoal = requireGoal(body.dailyGoal);
  if ('householdGoal' in body) patch.householdGoal = requireHouseholdGoal(body.householdGoal);
  if (body.resetHousehold === true) patch.resetHousehold = true;

  const changingPassword = 'newPassword' in body || 'currentPassword' in body;
  if (!patch.name && !patch.timezone && patch.dailyGoal == null && patch.householdGoal == null && !patch.resetHousehold && !changingPassword) {
    throw new HttpError(400, 'Nothing to update.');
  }

  if (changingPassword) {
    await changePassword(
      session.familyId,
      requirePassword(body.currentPassword),
      requirePassword(body.newPassword),
    );
  }
  if (patch.name || patch.timezone || patch.dailyGoal != null || patch.householdGoal != null || patch.resetHousehold) {
    await updateFamily(session.familyId, patch);
  }

  const active = await readActiveMemberId(session.token);
  return NextResponse.json(await getMe(session.familyId, active));
});
