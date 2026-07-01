import { createClient } from '@/lib/supabase/client';

export async function uploadStudentPhoto(file: File, studentId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${studentId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('student-photos').upload(path, file, {
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('student-photos').getPublicUrl(path);
  return data.publicUrl;
}
