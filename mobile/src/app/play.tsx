import { Redirect } from 'expo-router';
import { Screen } from '@/components/ui';
import { GroupApp } from '@/components/GroupApp';
import { useSession } from '@/session';

export default function Play() {
  const { ready, token } = useSession();
  if (!ready) return <Screen>{null}</Screen>;
  if (!token) return <Redirect href="/" />;
  return (
    <Screen>
      <GroupApp />
    </Screen>
  );
}
