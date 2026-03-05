"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { BilingualText } from "./BilingualText";

interface GpsCoords {
  latitude: number;
  longitude: number;
}

interface PhotoCaptureProps {
  onPhoto: (file: File, gps: GpsCoords | null) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

async function compressImage(file: File): Promise<Blob | null> {
  if (file.size <= MAX_BYTES) return file;

  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

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

export default function PhotoCapture({ onPhoto }: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setCompressionError(null);
    setProcessing(true);

    // Show preview immediately from original for responsiveness
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Extract EXIF from original file BEFORE compression (canvas re-encoding strips EXIF).
    // Use require() rather than import() so Jest module mocks work correctly without
    // Babel's _interopRequireWildcard double-wrapping the default export.
    let gps: GpsCoords | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const exifr = require("exifr").default as { gps: (f: File) => Promise<{ latitude: number; longitude: number } | null> };
      const result = await exifr.gps(file);
      if (result?.latitude && result?.longitude) {
        gps = { latitude: result.latitude, longitude: result.longitude };
      }
    } catch {
      // EXIF extraction failed — GPS will be null, user will pin manually
    }

    // Compress if oversized
    let finalFile: File;
    if (file.size > MAX_BYTES) {
      const compressed = await compressImage(file);
      if (!compressed) {
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        setProcessing(false);
        setCompressionError(
          "Photo is too large to compress. Please choose a smaller image."
        );
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

    setProcessing(false);
    onPhoto(finalFile, gps);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clearPhoto() {
    setPreview(null);
    setCompressionError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  if (preview) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="Captured photo"
          className="w-full max-h-80 object-cover rounded-xl"
        />
        <button
          onClick={clearPhoto}
          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
          aria-label="Remove photo"
        >
          <X className="w-5 h-5" />
        </button>
        {processing && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            Processing…
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {compressionError && (
        <p className="text-red-600 text-sm">{compressionError}</p>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Take Photo — primary tap target */}
      <button
        onClick={() => cameraRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-10 rounded-2xl shadow transition-colors"
      >
        <Camera className="w-12 h-12" />
        <BilingualText en="Take Photo" kn="ಫೋಟೋ ತೆಗೆಯಿರಿ" enClass="text-xl font-semibold" knClass="text-sm font-normal" containerClass="flex flex-col leading-tight" />
      </button>

      {/* Upload from Gallery — secondary */}
      <button
        onClick={() => galleryRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-2xl transition-colors"
      >
        <ImagePlus className="w-5 h-5" />
        <BilingualText en="Upload from Gallery" kn="ಗ್ಯಾಲರಿಯಿಂದ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" enClass="font-medium" knClass="text-sm font-normal" containerClass="flex flex-col leading-tight" />
      </button>
    </div>
  );
}
