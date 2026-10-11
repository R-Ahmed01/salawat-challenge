import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, createApi } from '@/api';
import { Alert, Field, GoldButton, Screen, TextButton } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

export default function Login() {
  const router = useRouter();
  const { server, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const result = await createApi(server, null, null)<{ token?: string }>('/api/auth/login', {
        body: { email, password },
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
          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>Log in</Text>
          <Text style={styles.lede}>This login opens the group, then you pick who is reciting.</Text>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          <Alert message={error} />
          <GoldButton label={saving ? 'One moment…' : 'Enter'} disabled={saving} onPress={() => void submit()} />
          <TextButton label="Join with a code" onPress={() => router.replace('/join')} />
          <TextButton label="Start a group" onPress={() => router.replace('/signup')} />
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
