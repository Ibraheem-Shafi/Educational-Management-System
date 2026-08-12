import { uploadViaSignedUrl } from '@/lib/upload-via-signed-url';

const DOCUMENTS_BUCKET = 'student-documents';

/** Upload a bank/online payment proof (screenshot/PDF) for a fee invoice. */
export async function uploadFeePaymentReceipt(
  file: File,
  invoiceId: string,
  accessToken: string,
): Promise<{ path: string; mimeType: string; sizeBytes: number; fileName: string }> {
  const uploaded = await uploadViaSignedUrl(
    file,
    `/fee-invoices/${invoiceId}/payment-receipt/upload-url`,
    accessToken,
    {},
    DOCUMENTS_BUCKET,
  );
  return {
    path: uploaded.path,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    fileName: uploaded.fileName,
  };
}
