import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { LoadingView } from '@/components/Screen';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { primaryColor } = useTheme();

  if (loading) return <LoadingView />;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: primaryColor,
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Home' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="fees" options={{ title: 'Fees' }} />
      <Tabs.Screen name="learning" options={{ title: 'Learning' }} />
      <Tabs.Screen name="more" options={{ title: 'More', headerShown: false }} />
    </Tabs>
  );
}
