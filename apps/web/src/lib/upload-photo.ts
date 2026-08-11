import { createClient } from '@/lib/supabase/client';
import { assertAllowedImage } from '@/lib/image-upload';
import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';

const PHOTOS_BUCKET = 'student-photos';

/** Upload a student photo via signed URL; returns a public URL for display. */
export async function uploadStudentPhoto(
  file: File,
  studentId: string,
  accessToken: string,
): Promise<string> {
  assertAllowedImage(file);
  const uploaded = await uploadViaSignedUrl(
    file,
    `/students/${studentId}/photo/upload-url`,
    accessToken,
    undefined,
    PHOTOS_BUCKET,
  );
  const supabase = createClient();
  const { data } = supabase.storage.from(uploaded.bucket || PHOTOS_BUCKET).getPublicUrl(uploaded.path);
  return data.publicUrl;
}
