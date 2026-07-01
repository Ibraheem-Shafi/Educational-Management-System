import { createClient } from '@/lib/supabase/client';

export async function uploadInstitutionAsset(
  file: File,
  folder: 'logo' | 'favicon',
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('institution-assets').upload(path, file, {
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('institution-assets').getPublicUrl(path);
  return data.publicUrl;
}
