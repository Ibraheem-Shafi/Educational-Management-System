import { useLocalSearchParams } from 'expo-router';
import { TeacherStudentDetailScreen } from '@/screens/teacher';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeacherStudentDetailScreen id={id} />;
}
