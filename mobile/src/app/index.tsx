import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createApi } from '@/api';
import { GoldButton, Screen } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

type Hadith = { english: string; source: string };

export default function Welcome() {
  const { ready, server } = useSession();
  const router = useRouter();
  const [hadith, setHadith] = useState<Hadith | null>(null);

  useEffect(() => {
    if (!ready) return;
    let gone = false;
    createApi(server, null, null)<Hadith>('/api/hadith')
      .then((next) => {
        if (!gone) setHadith(next);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [ready, server]);

  return (
    <Screen>
      <View style={styles.page}>
        <Text style={styles.word}>Salawat</Text>
        <Text style={styles.wordEm}>Challenge</Text>
        <View style={styles.middle}>
          <Image source={require('../../assets/mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
          {hadith ? (
            <View style={styles.hadithBlock}>
              <Text style={styles.hadith}>{hadith.english}</Text>
              <Text style={styles.source}>{hadith.source}</Text>
            </View>
          ) : null}
        </View>
        <GoldButton label="Continue" onPress={() => router.push('/menu')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 16 },
  word: { color: theme.cream, fontSize: 40, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center' },
  wordEm: { color: theme.gold, fontSize: 28, fontStyle: 'italic', textAlign: 'center', marginTop: -2 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingVertical: 12 },
  mark: { width: 150, height: 258 },
  hadithBlock: { gap: 10, paddingHorizontal: 8 },
  hadith: { color: theme.cream, fontSize: 17, lineHeight: 26, textAlign: 'center' },
  source: { color: theme.gold, fontSize: 13, letterSpacing: 0.6, textAlign: 'center' },
});
