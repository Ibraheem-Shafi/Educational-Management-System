import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';

const DOCUMENTS_BUCKET = 'student-documents';

/** Upload an employee document via service-role signed upload URL. */
export async function uploadEmployeeDocument(
  file: File,
  userId: string,
  branchId: string,
  accessToken: string,
): Promise<{ path: string; mimeType: string; sizeBytes: number }> {
  const uploaded = await uploadViaSignedUrl(
    file,
    '/documents/upload-url',
    accessToken,
    { branchId, userId },
    DOCUMENTS_BUCKET,
  );
  return {
    path: uploaded.path,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
  };
}
