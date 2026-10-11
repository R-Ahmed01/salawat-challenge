import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, createApi } from '@/api';
import { Alert, Field, GoldButton, Screen, TextButton } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

export default function Join() {
  const router = useRouter();
  const { server, signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const result = await createApi(server, null, null)<{ token?: string }>('/api/auth/join', {
        body: { code },
      });
      if (!result.token) throw new ApiError('The server did not start a session.', 500);
      await signIn(result.token);
      router.replace('/play');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Another phone</Text>
          <Text style={styles.title}>Join a group</Text>
          <Text style={styles.lede}>
            Enter the code from a phone that is already in the group. You will add to the same household total, on your
            own profile.
          </Text>
          <Field
            label="Group code"
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
          />
          <Alert message={error} />
          <GoldButton label={saving ? 'One moment…' : 'Join'} disabled={saving} onPress={() => void submit()} />
          <TextButton label="Log in" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { padding: 24, gap: 14 },
  kicker: { color: theme.gold, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 12 },
  title: { color: theme.cream, fontSize: 36 },
  lede: { color: theme.muted, fontSize: 16, lineHeight: 22 },
});
