import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        autoCorrect={false}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function GoldButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.gold, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.goldText}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Alert({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.alert}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.night,
  },
  field: {
    gap: 6,
  },
  label: {
    color: theme.muted,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    color: theme.cream,
    backgroundColor: theme.panel,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  gold: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goldText: {
    color: '#2a1c08',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  textButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  textButtonLabel: {
    color: theme.gold,
    fontSize: 15,
  },
  alert: {
    color: theme.danger,
    fontSize: 15,
  },
});
