// photo-store.ts
// Browser-only module singleton — NOT SSR-safe (never imported on server).
// Used to pass a processed photo from home page CTA → /report page on mount.

export interface PendingPhoto {
  file: File;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  locationSource: "exif" | "manual_pin";
  gpsConfirmed: boolean;
  photoTime: Date | null;
}

let _pending: PendingPhoto | null = null;

export function storePendingPhoto(p: PendingPhoto): void {
  _pending = p;
}

export function consumePendingPhoto(): PendingPhoto | null {
  const p = _pending;
  _pending = null;
  return p;
}
