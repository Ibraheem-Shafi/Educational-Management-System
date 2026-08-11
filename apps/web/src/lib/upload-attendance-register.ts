import { assertAllowedImage } from '@/lib/image-upload';
import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';

const ATTENDANCE_BUCKET = 'attendance-registers';

/** Upload an attendance register image via service-role signed upload URL. */
export async function uploadAttendanceRegister(
  file: File,
  branchId: string,
  accessToken: string,
): Promise<string> {
  assertAllowedImage(file);
  const uploaded = await uploadViaSignedUrl(
    file,
    '/ai-attendance/register-upload-url',
    accessToken,
    { branchId },
    ATTENDANCE_BUCKET,
  );
  return uploaded.path;
}
