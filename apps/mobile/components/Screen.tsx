import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme-context';

export function LoadingView({ message = 'Loading…' }: { message?: string }) {
  const { primaryColor } = useTheme();
  return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={primaryColor} />
      <Text style={styles.message}>{message}</Text>
    </SafeAreaView>
  );
}

export function ErrorView({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
    </SafeAreaView>
  );
}

export function EmptyView({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#b91c1c',
    marginBottom: 8,
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
  },
});
