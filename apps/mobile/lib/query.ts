import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';

const CACHE_KEY = 'eims-query-cache';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        gcTime: 1000 * 60 * 30,
        networkMode: 'offlineFirst',
      },
    },
  });
}

export async function restoreQueryCache(client: QueryClient) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    hydrate(client, JSON.parse(raw));
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY);
  }
}

export async function persistQueryCache(client: QueryClient) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dehydrate(client)));
  } catch {
    // ignore storage failures
  }
}
