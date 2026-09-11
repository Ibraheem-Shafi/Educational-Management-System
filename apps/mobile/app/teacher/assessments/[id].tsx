import { useLocalSearchParams } from 'expo-router';
import { TeacherMarksScreen } from '@/screens/teacher';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeacherMarksScreen id={id} />;
}
