import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

export default function MoreLayout() {
  const { primaryColor } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: primaryColor,
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="notices" options={{ title: 'Notices' }} />
      <Stack.Screen name="timetable" options={{ title: 'Timetable' }} />
      <Stack.Screen name="documents" options={{ title: 'Documents' }} />
      <Stack.Screen name="leave" options={{ title: 'Leave requests' }} />
      <Stack.Screen name="insights" options={{ title: 'Insights' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
