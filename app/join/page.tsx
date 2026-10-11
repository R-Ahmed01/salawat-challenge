import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  if (await getSession()) redirect('/play');
  return <AuthForm mode="join" />;
}
