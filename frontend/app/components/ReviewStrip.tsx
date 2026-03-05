"use client";

import { useEffect, useState } from "react";
import { BilingualText } from "./BilingualText";
import { getCategoryLabel } from "../lib/translations";

interface ReviewStripProps {
  photo: File | null;
  lat: number;
  lng: number;
  locationLabel?: string;
  category: string;
}

export default function ReviewStrip({
  photo,
  lat,
  lng,
  locationLabel,
  category,
}: ReviewStripProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null);

  // Create and revoke object URL for photo thumbnail
  useEffect(() => {
    if (!photo) {
      setThumbUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setThumbUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  // Reverse geocode via Nominatim unless locationLabel prop is provided
  useEffect(() => {
    if (locationLabel) return; // skip if caller provided a label directly
    if (!lat && !lng) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    (async () => {
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "BengaluruWalkabilityAudit/1.0" },
        });
        const data = await res.json();
        const label =
          data.address?.suburb ??
          data.address?.neighbourhood ??
          data.address?.road ??
          data.display_name?.split(",")[0] ??
          null;
        if (label) setGeocodedLabel(String(label).trim());
      } catch {
        // Silently fall back to coordinates
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [lat, lng, locationLabel]);

  // Determine what to display for location
  const displayLocation = locationLabel
    ? locationLabel
    : geocodedLabel
    ? geocodedLabel
    : lat || lng
    ? `${lat.toFixed(3)}, ${lng.toFixed(3)}`
    : null;

  const categoryLabel = category ? getCategoryLabel(category) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
      {/* Photo thumbnail */}
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt="photo thumbnail"
          className="w-8 h-8 object-cover rounded"
        />
      )}

      {/* Location */}
      {displayLocation && <span>{displayLocation}</span>}

      {/* Category */}
      {categoryLabel && (
        <BilingualText
          en={categoryLabel.en}
          kn={categoryLabel.kn}
          containerClass="flex flex-col leading-tight"
        />
      )}
    </div>
  );
}
