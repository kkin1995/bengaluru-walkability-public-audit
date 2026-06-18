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

  // Use FileReader to produce a data: URL so img.src receives a string
  // whose prefix is statically verifiable — satisfies XSS data-flow analysis.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("compressImage: file is not a supported image type");
  }

  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

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
