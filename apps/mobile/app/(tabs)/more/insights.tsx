import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { ErrorView, LoadingView } from '@/components/Screen';
import { Card, ListRow, Screen, StatRow } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { APP_ROLE } from '@/lib/config';
import type { PortalStudentInsightsResponse } from '@/lib/types';

export default function InsightsScreen() {
  if (APP_ROLE !== 'student') {
    return <Redirect href="/(tabs)/more" />;
  }

  const { accessToken } = useAuth();

  const query = useQuery({
    queryKey: ['insights'],
    queryFn: () =>
      apiClient<PortalStudentInsightsResponse>('/portal/student/insights', { token: accessToken }),
    enabled: !!accessToken,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed to load insights'} />
      </SafeAreaView>
    );
  }

  const data = query.data!;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Screen title="Insights" subtitle={data.narrative}>
        <Card>
          <StatRow
            label="Overall"
            value={data.overallPercentage != null ? `${data.overallPercentage}%` : 'N/A'}
          />
        </Card>

        {data.subjects.map((subject) => (
          <ListRow
            key={subject.subjectName}
            title={subject.subjectName}
            subtitle={
              subject.averagePercentage != null ? `${subject.averagePercentage}% average` : 'No data'
            }
          />
        ))}

        {data.recommendations.map((rec, index) => (
          <ListRow key={`${rec.subject}-${index}`} title={rec.subject} subtitle={rec.tip} />
        ))}
      </Screen>
    </SafeAreaView>
  );
}
