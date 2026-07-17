import Constants from 'expo-constants';
import type { AppRole } from './types';

const extra = Constants.expoConfig?.extra ?? {};

export const APP_ROLE: AppRole = extra.appRole === 'student' ? 'student' : 'parent';
export const API_URL: string = extra.apiUrl ?? 'http://localhost:3001';
export const SUPABASE_URL: string = extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey ?? '';

export function portalBase(): 'parent' | 'student' {
  return APP_ROLE;
}

export function buildPortalQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
