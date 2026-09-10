import { Stack } from 'expo-router';
import { RoleGate } from '@/components/RoleGate';
import { colors } from '@/lib/theme';

export default function TeacherLayout() {
  return (
    <RoleGate role="teacher">
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="students/[id]" options={{ title: 'Student' }} />
        <Stack.Screen name="assessments/index" options={{ title: 'Assessments' }} />
        <Stack.Screen name="assessments/[id]" options={{ title: 'Marks' }} />
        <Stack.Screen name="timetable" options={{ title: 'Timetable' }} />
        <Stack.Screen name="notices/index" options={{ title: 'Notices' }} />
        <Stack.Screen name="notices/[id]" options={{ title: 'Notice' }} />
        <Stack.Screen name="leave" options={{ title: 'Leave' }} />
        <Stack.Screen name="parents" options={{ title: 'Parents' }} />
        <Stack.Screen name="documents" options={{ title: 'Documents' }} />
        <Stack.Screen name="reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Stack.Screen name="ai-insights" options={{ title: 'AI Insights' }} />
        <Stack.Screen name="ai-attendance" options={{ title: 'AI Attendance' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="resource-new" options={{ title: 'New resource' }} />
        <Stack.Screen name="resource/[id]" options={{ title: 'Learning' }} />
      </Stack>
    </RoleGate>
  );
}
