import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';

export type SignedUploadPrepareResult = {
  bucket: string;
  path: string;
  token: string;
  signedUrl?: string;
};

/**
 * Prepare a service-role signed upload URL via the Nest API, then PUT the file
 * with `uploadToSignedUrl` so private buckets work without Storage INSERT RLS.
 */
export async function uploadViaSignedUrl(
  file: File,
  preparePath: string,
  accessToken: string,
  body?: Record<string, unknown>,
  fallbackBucket?: string,
): Promise<{ path: string; mimeType: string; sizeBytes: number; fileName: string; bucket: string }> {
  const prepared = await apiClient<SignedUploadPrepareResult>(preparePath, {
    method: 'POST',
    token: accessToken,
    body: JSON.stringify({ fileName: file.name, ...(body ?? {}) }),
  });

  const bucket = prepared.bucket || fallbackBucket || '';
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      ...(file.type ? { contentType: file.type } : {}),
    });

  if (error) throw new Error(error.message);

  return {
    path: prepared.path,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    fileName: file.name,
    bucket,
  };
}
