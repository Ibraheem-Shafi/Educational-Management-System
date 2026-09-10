import { useLocalSearchParams } from 'expo-router';
import { TeacherLearningDetailScreen } from '@/screens/teacher';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeacherLearningDetailScreen id={id} />;
}
