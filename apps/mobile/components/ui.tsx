import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme-context';

export function Screen({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function StatRow({ label, value }: { label: string; value: string | number }) {
  const { primaryColor } = useTheme();
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: primaryColor }]}>{value}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.listRow}>
      <Text style={styles.listTitle}>{title}</Text>
      {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { primaryColor } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primaryColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statLabel: {
    fontSize: 15,
    color: '#475569',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  listRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  listSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
