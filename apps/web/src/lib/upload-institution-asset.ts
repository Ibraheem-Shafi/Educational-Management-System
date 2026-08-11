import { createClient } from '@/lib/supabase/client';
import { assertAllowedImage } from '@/lib/image-upload';
import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';

const ASSETS_BUCKET = 'institution-assets';

/** Upload institution logo/favicon via signed URL; returns a public URL. */
export async function uploadInstitutionAsset(
  file: File,
  folder: 'logo' | 'favicon',
  accessToken: string,
): Promise<string> {
  assertAllowedImage(file);
  const uploaded = await uploadViaSignedUrl(
    file,
    '/settings/institution-assets/upload-url',
    accessToken,
    { folder },
    ASSETS_BUCKET,
  );
  const supabase = createClient();
  const { data } = supabase.storage.from(uploaded.bucket || ASSETS_BUCKET).getPublicUrl(uploaded.path);
  return data.publicUrl;
}
