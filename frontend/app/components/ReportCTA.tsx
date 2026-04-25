"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bi } from "@/app/components/ui/Bi";
import { Btn } from "@/app/components/ui/Btn";
import { Icon } from "@/app/components/ui/Icon";
import { storePendingPhoto } from "@/app/lib/photo-store";

const MAX_BYTES = 10 * 1024 * 1024;

async function compressImage(file: File): Promise<Blob | null> {
  if (file.size <= MAX_BYTES) return file;
  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
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

export function ReportCTA() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so re-selecting the same file fires onChange next time (WR-02)
    e.target.value = "";
    setProcessing(true);

    // Preview from original (matches report/page.tsx pattern)
    const previewUrl = URL.createObjectURL(file);

    // EXIF extraction on ORIGINAL file before compression
    let lat: number | null = null;
    let lng: number | null = null;
    let gpsConfirmed = false;
    let locationSource: "exif" | "manual_pin" = "manual_pin";
    let photoTime: Date | null = null;
    try {
      const exifrModule = require("exifr");
      const exifr = (exifrModule.default ?? exifrModule) as {
        gps: (f: File) => Promise<{ latitude: number; longitude: number } | null>;
        parse: (f: File, opts: Record<string, boolean>) => Promise<Record<string, unknown> | null>;
      };
      const [gpsResult, exifData] = await Promise.all([
        exifr.gps(file).catch(() => null),
        exifr.parse(file, { DateTimeOriginal: true }).catch(() => null),
      ]);
      if (gpsResult?.latitude && gpsResult?.longitude) {
        lat = gpsResult.latitude;
        lng = gpsResult.longitude;
        gpsConfirmed = true;
        locationSource = "exif";
      }
      if (exifData?.DateTimeOriginal instanceof Date) {
        photoTime = exifData.DateTimeOriginal as Date;
      }
    } catch {
      // EXIF extraction failed — manual pin fallback on /report
    }
    if (!photoTime) photoTime = new Date();

    // Compress if oversized
    let finalFile: File;
    if (file.size > MAX_BYTES) {
      const compressed = await compressImage(file);
      if (!compressed) {
        URL.revokeObjectURL(previewUrl); // WR-01: revoke to prevent object URL leak
        setProcessing(false);
        // Can't compress — fall back to /report photo step so user sees error
        router.push("/report");
        return;
      }
      finalFile = new File(
        [compressed],
        file.name.replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" }
      );
    } else {
      finalFile = file;
    }

    storePendingPhoto({ file: finalFile, previewUrl, lat, lng, locationSource, gpsConfirmed, photoTime });
    setProcessing(false);
    router.push("/report");
  }

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so re-selecting the same file fires onChange next time (WR-02)
    e.target.value = "";
    setProcessing(true);

    const previewUrl = URL.createObjectURL(file);

    let lat: number | null = null;
    let lng: number | null = null;
    let gpsConfirmed = false;
    let locationSource: "exif" | "manual_pin" = "manual_pin";
    let photoTime: Date | null = null;
    try {
      const exifrModule = require("exifr");
      const exifr = (exifrModule.default ?? exifrModule) as {
        gps: (f: File) => Promise<{ latitude: number; longitude: number } | null>;
        parse: (f: File, opts: Record<string, boolean>) => Promise<Record<string, unknown> | null>;
      };
      const [gpsResult, exifData] = await Promise.all([
        exifr.gps(file).catch(() => null),
        exifr.parse(file, { DateTimeOriginal: true }).catch(() => null),
      ]);
      if (gpsResult?.latitude && gpsResult?.longitude) {
        lat = gpsResult.latitude;
        lng = gpsResult.longitude;
        gpsConfirmed = true;
        locationSource = "exif";
      }
      if (exifData?.DateTimeOriginal instanceof Date) {
        photoTime = exifData.DateTimeOriginal as Date;
      }
    } catch {
      // EXIF extraction failed — manual pin fallback on /report
    }
    if (!photoTime) photoTime = new Date();

    let finalFile: File;
    if (file.size > MAX_BYTES) {
      const compressed = await compressImage(file);
      if (!compressed) {
        URL.revokeObjectURL(previewUrl); // WR-01: revoke to prevent object URL leak
        setProcessing(false);
        router.push("/report");
        return;
      }
      finalFile = new File(
        [compressed],
        file.name.replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" }
      );
    } else {
      finalFile = file;
    }

    storePendingPhoto({ file: finalFile, previewUrl, lat, lng, locationSource, gpsConfirmed, photoTime });
    setProcessing(false);
    router.push("/report");
  }

  return (
    <>
      <label
        className="press"
        style={{
          display: "block",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <Btn
          variant="accent"
          size="xl"
          style={{ width: "100%", pointerEvents: "none" }}
          aria-hidden="true"
          tabIndex={-1}
        >
          <Icon name="camera" size={22} />
          <Bi
            en={processing ? "Processing…" : "Report an issue"}
            kn={processing ? undefined : "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ"}
            style={{ alignItems: "center" }}
          />
        </Btn>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: "pointer",
            width: "100%",
            height: "100%",
          }}
          onChange={handleChange}
          aria-label="Report an issue — open camera"
        />
      </label>

      {/* Gallery escape hatch — 14px below primary CTA (per D-05) */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <button
          type="button"
          className="press"
          onClick={() => galleryRef.current?.click()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontSize: 13,
            cursor: "pointer",
          }}
          aria-label="Upload a saved photo from gallery"
        >
          <Icon name="image" size={16} aria-hidden={true} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <Bi
            en="or upload a saved photo"
            kn="ಉಳಿಸಿದ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ"
            style={{
              alignItems: "center",
              borderBottom: "1px solid var(--border-strong)",
            }}
          />
        </button>
      </div>

      {/* Hidden gallery file input — no capture attribute so OS shows full picker */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleGalleryChange}
        aria-label="Upload a saved photo — open gallery"
      />
    </>
  );
}
