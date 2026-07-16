'use client';

import { useParams } from 'next/navigation';
import { ProgramForm } from '@/components/features/academic/program-form';

export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>();
  return <ProgramForm mode="edit" programId={id} />;
}
