import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';

const LEAVE_BUCKET = 'leave-attachments';

/** Upload a leave supporting document via service-role signed upload URL. */
export async function uploadLeaveAttachment(
  file: File,
  leaveRequestId: string,
  accessToken: string,
  options?: { portal?: boolean },
): Promise<{ path: string; mimeType: string; sizeBytes: number; fileName: string }> {
  const base = options?.portal
    ? `/portal/parent/leave/${leaveRequestId}`
    : `/leave-requests/${leaveRequestId}`;

  const prepared = await apiClient<{
    bucket: string;
    path: string;
    token: string;
  }>(`${base}/attachment/upload-url`, {
    method: 'POST',
    token: accessToken,
    body: JSON.stringify({ fileName: file.name }),
  });

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(prepared.bucket || LEAVE_BUCKET)
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
