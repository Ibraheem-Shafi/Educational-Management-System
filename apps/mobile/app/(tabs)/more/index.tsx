import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow, PrimaryButton, Screen } from '@/components/ui';
import { APP_ROLE } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';

export default function MoreMenuScreen() {
  const { signOut } = useAuth();

  const items = [
    { label: 'Notices', href: '/(tabs)/more/notices' as const },
    { label: 'Timetable', href: '/(tabs)/more/timetable' as const },
    { label: 'Documents', href: '/(tabs)/more/documents' as const },
    ...(APP_ROLE === 'parent'
      ? [{ label: 'Leave requests', href: '/(tabs)/more/leave' as const }]
      : [{ label: 'Insights', href: '/(tabs)/more/insights' as const }]),
    { label: 'Profile', href: '/(tabs)/more/profile' as const },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="More">
        {items.map((item) => (
          <ListRow key={item.href} title={item.label} onPress={() => router.push(item.href)} />
        ))}
        <PrimaryButton
          label="Sign out"
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}
