import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, TextButton } from '@/components/ui';
import { useSession } from '@/session';
import { theme } from '@/theme';

const CHOICES = [
  {
    label: 'Start a group',
    hint: 'A household total everyone moves together',
    href: '/signup',
  },
  {
    label: 'Join a group',
    hint: 'Use the code from a phone already in the group',
    href: '/join',
  },
  {
    label: 'Read for a loved one',
    hint: 'Name who this round of salawat is for',
    href: '/loved',
  },
  {
    label: 'Log in',
    hint: 'Open a group you already belong to',
    href: '/login',
  },
] as const;

export default function Menu() {
  const router = useRouter();
  const { token } = useSession();

  return (
    <Screen>
      <View style={styles.page}>
        <Text style={styles.kicker}>The group</Text>
        <Text style={styles.title}>How will you recite?</Text>
        <View style={styles.list}>
          {CHOICES.map((choice, index) => (
            <Pressable
              key={choice.href}
              accessibilityRole="button"
              onPress={() => {
                if (token && choice.href !== '/loved') {
                  router.push('/play');
                  return;
                }
                router.push(choice.href);
              }}
              style={({ pressed }) => [styles.card, index === 0 && styles.cardFirst, pressed && styles.pressed]}
            >
              <Text style={[styles.label, index === 0 && styles.labelFirst]}>{choice.label}</Text>
              <Text style={[styles.hint, index === 0 && styles.hintFirst]}>{choice.hint}</Text>
            </Pressable>
          ))}
        </View>
        <TextButton label="Back" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12, gap: 18 },
  kicker: { color: theme.gold, letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12 },
  title: { color: theme.cream, fontSize: 36, fontWeight: '600', letterSpacing: -0.4 },
  list: { flex: 1, justifyContent: 'center', gap: 12 },
  card: {
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 4,
  },
  cardFirst: { backgroundColor: theme.gold, borderColor: theme.gold },
  label: { color: theme.cream, fontSize: 20, fontWeight: '700' },
  labelFirst: { color: '#2a1c08' },
  hint: { color: theme.muted, fontSize: 14, lineHeight: 20 },
  hintFirst: { color: 'rgba(42, 28, 8, 0.72)' },
  pressed: { opacity: 0.88 },
});
