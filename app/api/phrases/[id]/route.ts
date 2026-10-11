import { NextResponse } from 'next/server';
import { fail } from '@/lib/http';
import { deletePhrase, getMe } from '@/lib/repo';
import { readActiveMemberId, requireSession } from '@/lib/session';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    await deletePhrase(session.familyId, id);
    const active = await readActiveMemberId(session.token);
    return NextResponse.json(await getMe(session.familyId, active));
  } catch (error) {
    return fail(error);
  }
}
