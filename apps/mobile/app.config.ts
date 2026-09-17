import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Nexium Academy',
  slug: 'nexium-academy',
  scheme: 'nexium',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    backgroundColor: '#0b1f3a',
    resizeMode: 'contain',
  },
  android: {
    package: 'pk.edu.nexium.app',
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#0b1f3a',
    },
  },
  ios: {
    bundleIdentifier: 'pk.edu.nexium.app',
    supportsTablet: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
  plugins: [
    'expo-router',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0b1f3a',
        image: './assets/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    'expo-secure-store',
    'expo-notifications',
    'expo-document-picker',
  ],
};

export default config;
