import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function PinPad({
  name,
  error,
  onSubmit,
  onBack,
}: {
  name: string;
  error: string | null;
  onSubmit: (pin: string) => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState('');

  useEffect(() => {
    if (error) setDigits('');
  }, [error]);

  function press(key: (typeof KEYS)[number]) {
    if (!key) return;
    if (key === 'del') {
      setDigits((current) => current.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === 4) onSubmit(next);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>PIN</Text>
      <Text style={styles.title}>{name}</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.dot, index < digits.length && styles.dotOn]} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.hint}>Four digits.</Text>}
      <View style={styles.pad}>
        {KEYS.map((key) =>
          key ? (
            <Pressable key={key} onPress={() => press(key)} style={styles.key}>
              <Text style={styles.keyText}>{key === 'del' ? '⌫' : key}</Text>
            </Pressable>
          ) : (
            <View key="gap" style={styles.key} />
          ),
        )}
      </View>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>Back to profiles</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  kicker: {
    color: theme.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    color: theme.cream,
    fontSize: 32,
  },
  dots: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.gold,
  },
  dotOn: {
    backgroundColor: theme.gold,
  },
  hint: {
    color: theme.muted,
  },
  error: {
    color: theme.danger,
  },
  pad: {
    width: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  key: {
    width: 84,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: theme.cream,
    fontSize: 28,
  },
  back: {
    color: theme.gold,
    marginTop: 8,
  },
});
