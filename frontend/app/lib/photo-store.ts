// photo-store.ts
// Browser-only — NOT SSR-safe (never imported on server).
// Uses window-level storage so the reference survives Next.js App Router
// code-split chunk boundaries (module-level vars are not shared across chunks).

export interface PendingPhoto {
  file: File;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  // FIX-13 (D-33): Canonical location_source values. T-05-06: backend typed binding rejects non-enum.
  locationSource: "EXIF_GPS" | "GPS_API" | "MANUAL_ADJUST";
  gpsConfirmed: boolean;
  photoTime: Date | null;
}

declare global {
  interface Window { __pendingPhoto?: PendingPhoto | null }
}

export function storePendingPhoto(p: PendingPhoto): void {
  if (typeof window === "undefined") return;
  // Revoke the previous preview URL to prevent blob URL accumulation on low-memory devices
  const prev = window.__pendingPhoto;
  if (prev?.previewUrl) {
    try { URL.revokeObjectURL(prev.previewUrl); } catch { /* ignore */ }
  }
  window.__pendingPhoto = p;
}

export function consumePendingPhoto(): PendingPhoto | null {
  if (typeof window === "undefined") return null;
  const p = window.__pendingPhoto ?? null;
  window.__pendingPhoto = null;
  return p;
}
