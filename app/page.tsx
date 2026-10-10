import { Landing } from '@/components/Landing';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  return <Landing loggedIn={Boolean(session)} />;
}
