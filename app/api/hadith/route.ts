import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors';
import { api } from '@/lib/http';
import { randomHadith } from '@/lib/repo';

export const GET = api(async () => {
  const hadith = await randomHadith();
  if (!hadith) throw new HttpError(404, 'No hadith is ready yet.');
  return NextResponse.json(hadith);
});
