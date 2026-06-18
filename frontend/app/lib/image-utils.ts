// image-utils.ts
// Browser-only image utilities — NOT SSR-safe.
// Used by ReportCTA and report/page.tsx to compress photos before upload.

export const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Compress a JPEG image to at most MAX_BYTES by progressively lowering quality.
 * Returns the compressed Blob on success, or null if no quality step fits.
 * If the file is already within the size limit, returns the original file unmodified.
 */
export async function compressImage(file: File): Promise<Blob | null> {
  if (file.size <= MAX_BYTES) return file;
  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url; // lgtm[js/xss-through-dom] -- url is always a blob: URL from URL.createObjectURL; never javascript: or data:
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.4]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return null;
}
