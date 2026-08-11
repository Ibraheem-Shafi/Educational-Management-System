import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';

const LEARNING_BUCKET = 'learning-content';

/**
 * Upload a learning attachment using a service-role signed upload URL.
 * Avoids RLS INSERT failures on the private `learning-content` bucket.
 */
export async function uploadLearningContent(
  file: File,
  resourceId: string,
  accessToken: string,
): Promise<{ path: string; mimeType: string; sizeBytes: number; fileName: string }> {
  const prepared = await apiClient<{
    bucket: string;
    path: string;
    token: string;
    signedUrl: string;
  }>(`/learning/${resourceId}/attachments/upload-url`, {
    method: 'POST',
    token: accessToken,
    body: JSON.stringify({ fileName: file.name }),
  });

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(prepared.bucket || LEARNING_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      ...(file.type ? { contentType: file.type } : {}),
    });

  if (error) throw new Error(error.message);

  return {
    path: prepared.path,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    fileName: file.name,
  };
}
