import type { ExpoConfig } from 'expo/config';

const role = process.env.APP_ROLE === 'student' ? 'student' : 'parent';

const config: ExpoConfig = {
  name: role === 'student' ? 'Nexium Student' : 'Nexium Parent',
  slug: role === 'student' ? 'nexium-student' : 'nexium-parent',
  scheme: role === 'student' ? 'nexium-student' : 'nexium-parent',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  android: {
    package: role === 'student' ? 'pk.edu.nexium.student' : 'pk.edu.nexium.parent',
    adaptiveIcon: {
      backgroundColor: '#1e40af',
    },
  },
  extra: {
    appRole: role,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-notifications'],
};

export default config;
