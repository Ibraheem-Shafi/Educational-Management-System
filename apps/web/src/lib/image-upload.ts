/** Blocked image MIME types (animated GIF not allowed). */
const BLOCKED_IMAGE_MIME_TYPES = new Set(['image/gif']);

const BLOCKED_EXTENSIONS = new Set(['gif']);

/**
 * HTML file input accept: any image except GIF.
 * Browsers still may show GIF under image/*; runtime check rejects them.
 */
export const ACCEPT_IMAGE_NO_GIF = 'image/jpeg,image/png,image/webp,image/bmp,image/svg+xml,.jpg,.jpeg,.png,.webp,.bmp,.svg';

/** @deprecated Use ACCEPT_IMAGE_NO_GIF */
export const ACCEPT_IMAGE_JPG_PNG = ACCEPT_IMAGE_NO_GIF;

export function assertAllowedImage(file: File): void {
  const mime = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (mime === 'image/gif' || BLOCKED_IMAGE_MIME_TYPES.has(mime) || BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error('GIF images are not allowed. Please upload another image format.');
  }

  if (mime) {
    if (!mime.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }
    return;
  }

  // No MIME from browser — require a known non-gif image extension
  const knownImageExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif', 'avif', 'tif', 'tiff']);
  if (!knownImageExt.has(ext)) {
    throw new Error('Only image files are allowed');
  }
}

/** @deprecated Use assertAllowedImage */
export function assertJpgOrPng(file: File): void {
  assertAllowedImage(file);
}
