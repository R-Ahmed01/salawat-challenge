import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, createApi } from '@/api';
import { Alert, Field, GoldButton, Screen, TextButton } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

export default function Signup() {
  const router = useRouter();
  const { server, signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const result = await createApi(server, null, null)<{ token?: string }>('/api/auth/signup', {
        body: { name, email, password, timezone },
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
          <Text style={styles.kicker}>New group</Text>
          <Text style={styles.title}>Start a group</Text>
          <Text style={styles.lede}>
            One email and password for the whole group. Other phones join with the code shown after you start.
          </Text>
          <Field label="Group name" value={name} onChangeText={setName} maxLength={40} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <Text style={styles.quiet}>At least 8 characters.</Text>
          <Alert message={error} />
          <GoldButton label={saving ? 'One moment…' : 'Create the group'} disabled={saving} onPress={() => void submit()} />
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
  quiet: { color: theme.muted, fontSize: 13 },
});
