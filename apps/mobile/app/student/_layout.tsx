import { Stack } from 'expo-router';
import { RoleGate } from '@/components/RoleGate';
import { colors } from '@/lib/theme';

export default function StudentLayout() {
  return (
    <RoleGate role="student">
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="assessments" options={{ title: 'Assessments' }} />
        <Stack.Screen name="timetable" options={{ title: 'Timetable' }} />
        <Stack.Screen name="notices/index" options={{ title: 'Notices' }} />
        <Stack.Screen name="notices/[id]" options={{ title: 'Notice' }} />
        <Stack.Screen name="learning/[id]" options={{ title: 'Learning' }} />
        <Stack.Screen name="documents" options={{ title: 'Documents' }} />
        <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Stack.Screen name="insights" options={{ title: 'Insights' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="pay/[paymentId]" options={{ title: 'Pay fees' }} />
      </Stack>
    </RoleGate>
  );
}
