import { NextResponse } from 'next/server';
import { fail, readBody } from '@/lib/http';
import { deleteMember, getMe, updateMember } from '@/lib/repo';
import { clearPlayerCookie, readActiveMemberId, requireSession } from '@/lib/session';
import { optionalPin, requireColor, requirePersonName } from '@/lib/validate';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await readBody(request);
    await updateMember(session.familyId, id, {
      name: 'name' in body ? requirePersonName(body.name) : undefined,
      color: 'color' in body ? requireColor(body.color) : undefined,
      pin: 'pin' in body ? optionalPin(body.pin) : undefined,
      clearPin: body.clearPin === true,
    });
    const active = await readActiveMemberId(session.token);
    return NextResponse.json(await getMe(session.familyId, active));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const active = await readActiveMemberId(session.token);
    await deleteMember(session.familyId, id);
    if (active === id) await clearPlayerCookie();
    return NextResponse.json(await getMe(session.familyId, active === id ? null : active));
  } catch (error) {
    return fail(error);
  }
}
