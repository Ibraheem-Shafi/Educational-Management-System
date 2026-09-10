import { Tabs } from 'expo-router';
import { BookOpen, Home, Users, Wallet, Menu } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export default function ParentTabs() {
  const { primaryColor } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.navy,
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: colors.soft,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="children" options={{ title: 'Children', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="learning" options={{ title: 'Learning', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
      <Tabs.Screen name="fees" options={{ title: 'Fees', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }} />
    </Tabs>
  );
}
