'use client';

import { useParams } from 'next/navigation';
import { AdmitStudentForm } from '@/components/features/students/admit-student-form';

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  return <AdmitStudentForm studentId={id} />;
}
