import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './api';
import type { AppRole } from './role';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let lastPushToken: string | null = null;

export async function registerPushToken(accessToken: string, appRole: AppRole): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  lastPushToken = tokenData.data;

  await apiClient('/device-tokens', {
    method: 'POST',
    token: accessToken,
    body: {
      token: tokenData.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appRole,
    },
  });
}

export async function unregisterPushToken(accessToken: string): Promise<void> {
  if (!lastPushToken) return;
  try {
    await apiClient('/device-tokens', {
      method: 'DELETE',
      token: accessToken,
      body: { token: lastPushToken },
    });
  } catch {
    // ignore network errors on logout
  } finally {
    lastPushToken = null;
  }
}
