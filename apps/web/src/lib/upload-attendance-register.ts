import { createClient } from '@/lib/supabase/client';

export async function uploadAttendanceRegister(
  file: File,
  sessionKey: string,
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${sessionKey}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('attendance-registers').upload(path, file, {
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}
