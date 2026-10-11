import { NextResponse } from 'next/server';
import { api } from '@/lib/http';
import { getMonth } from '@/lib/repo';
import { requireSession } from '@/lib/session';
import { requireMonth } from '@/lib/validate';

export const GET = api(async (request) => {
  const session = await requireSession();
  const month = new URL(request.url).searchParams.get('month');
  return NextResponse.json(await getMonth(session.familyId, requireMonth(month)));
});
