import { redirect } from 'next/navigation';
import { PlayApp } from '@/components/PlayApp';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PlayPage() {
  if (!(await getSession())) redirect('/login');
  return <PlayApp />;
}
