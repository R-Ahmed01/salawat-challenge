import { NextResponse } from 'next/server';
import { api, readBody } from '@/lib/http';
import { createPhrase, getMe } from '@/lib/repo';
import { readActiveMemberId, requireSession } from '@/lib/session';
import { requireArabic, requireLatin, requirePhraseLabel } from '@/lib/validate';

export const POST = api(async (request) => {
  const session = await requireSession();
  const body = await readBody(request);
  await createPhrase(session.familyId, {
    label: requirePhraseLabel(body.label),
    arabic: requireArabic(body.arabic),
    latin: requireLatin(body.latin),
  });
  const active = await readActiveMemberId(session.token);
  return NextResponse.json(await getMe(session.familyId, active));
});
