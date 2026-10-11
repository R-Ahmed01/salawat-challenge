import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PHRASES } from '@/copy';
import { holdDedication } from '@/dedication';
import { GoldButton, Screen, TextButton, Field } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

const phrase = PHRASES[0];

export default function Loved() {
  const router = useRouter();
  const { token } = useSession();
  const [name, setName] = useState('');
  const ready = name.trim().length > 0;

  function carry(href: '/signup' | '/join' | '/login' | '/play') {
    holdDedication(name);
    router.push(href);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TextButton label="Back" onPress={() => router.back()} />
        <Text style={styles.kicker}>A dedication</Text>
        <Text style={styles.title}>Read for a loved one</Text>
        <Text style={styles.lede}>Name them. Once you are in a group, this round is stored with that name.</Text>
        <Field label="This round is for" value={name} onChangeText={setName} maxLength={40} placeholder="Their name" />
        <View style={styles.phrase}>
          <Text style={styles.arabic}>{phrase.arabic}</Text>
          <Text style={styles.latin}>{phrase.latin}</Text>
        </View>
        {token ? (
          <GoldButton label="Count for them" disabled={!ready} onPress={() => carry('/play')} />
        ) : (
          <GoldButton label="Start a group" disabled={!ready} onPress={() => carry('/signup')} />
        )}
        {token ? null : (
          <View style={styles.links}>
            <TextButton label="Join a group" onPress={() => (ready ? carry('/join') : undefined)} />
            <TextButton label="Log in" onPress={() => (ready ? carry('/login') : undefined)} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28, gap: 16 },
  kicker: { color: theme.gold, letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12 },
  title: { color: theme.cream, fontSize: 34, fontWeight: '600', letterSpacing: -0.4 },
  lede: { color: theme.muted, fontSize: 16, lineHeight: 23 },
  phrase: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  arabic: { color: theme.cream, fontSize: 28, textAlign: 'center', writingDirection: 'rtl' },
  latin: { color: theme.muted, fontSize: 15, textAlign: 'center' },
  links: { alignItems: 'center', gap: 4 },
});
