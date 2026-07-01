import { createClient } from '@/lib/supabase/client';

export async function uploadStudentDocument(
  file: File,
  studentId: string,
): Promise<{ path: string; mimeType: string; sizeBytes: number }> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${studentId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('student-documents').upload(path, file, {
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size };
}
