import '../global.css';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ChildProvider } from '@/lib/child-context';
import { createQueryClient, persistQueryCache, restoreQueryCache } from '@/lib/query';
import { ThemeProvider } from '@/lib/theme-context';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>The app failed to load</Text>
      <Text style={{ textAlign: 'center', color: '#5b6472', marginBottom: 16 }}>{error.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#0b1f3a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    void restoreQueryCache(queryClient);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void persistQueryCache(queryClient);
      }, 1500);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ChildProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="parent" />
                  <Stack.Screen name="student" />
                  <Stack.Screen name="teacher" />
                </Stack>
              </ChildProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </View>
  );
}
