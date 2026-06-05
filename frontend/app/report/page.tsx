"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { API_BASE_URL } from "@/app/lib/config";
import { BENGALURU_BOUNDS, BENGALURU_CENTER } from "@/app/lib/constants";
import { getCategoryLabel } from "@/app/lib/translations";
import { consumePendingPhoto } from "@/app/lib/photo-store";
import { MAX_BYTES, compressImage } from "@/app/lib/image-utils";
import { Bi } from "@/app/components/ui/Bi";
import { Btn } from "@/app/components/ui/Btn";
import { Icon } from "@/app/components/ui/Icon";
import { Pill } from "@/app/components/ui/Pill";
import { SectionLabel } from "@/app/components/ui/SectionLabel";
import { CategoryGrid } from "@/app/components/redesign/CategoryGrid";
import { SeverityGrid } from "@/app/components/redesign/SeverityGrid";
import { SuccessCard } from "@/app/components/redesign/SuccessCard";

// Location map for optional "Adjust" fallback when GPS is missing
const LocationMap = dynamic(() => import("../components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 200,
        background: "var(--surface-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

type Step = "photo" | "category" | "confirm";

interface FormState {
  file: File | null;
  lat: number;
  lng: number;
  // FIX-13 (D-33): Canonical values matching DB enum after migration 015
  locationSource: "EXIF_GPS" | "GPS_API" | "MANUAL_ADJUST";
  gpsConfirmed: boolean;
  category: string;
  severity: string;
  description: string;
  name: string;
  contact: string;
  photoTime: Date | null;
}

const INITIAL_FORM: FormState = {
  file: null,
  lat: BENGALURU_CENTER.lat,
  lng: BENGALURU_CENTER.lng,
  locationSource: "GPS_API",
  gpsConfirmed: false,
  category: "",
  severity: "medium",
  description: "",
  name: "",
  contact: "",
  photoTime: null,
};

function isInBengaluru(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_BOUNDS.latMin &&
    lat <= BENGALURU_BOUNDS.latMax &&
    lng >= BENGALURU_BOUNDS.lngMin &&
    lng <= BENGALURU_BOUNDS.lngMax
  );
}

export default function ReportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photo");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [cameFromCTA, setCameFromCTA] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showAdjustMap, setShowAdjustMap] = useState(false);
  const [showContact, setShowContact] = useState(false);
  // BUG-2: true while browser geolocation is in-flight after an EXIF miss
  const [gpsLocating, setGpsLocating] = useState(false);
  // BUG-2: true once browser geo attempt has finished and failed
  const [gpsFailed, setGpsFailed] = useState(false);
  // BUG-3: ward label fetched from the public /api/wards/lookup endpoint
  const [wardLabel, setWardLabel] = useState<string | null>(null);
  const [wardLoading, setWardLoading] = useState(false);
  // BUG-4: nearby road name from Nominatim reverse geocoding
  const [nearRoad, setNearRoad] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // BUG-2: Attempt browser geolocation as a fallback after an EXIF miss.
  // Must run concurrently — does NOT block navigation to "category" step.
  // On success: update lat/lng and set gpsConfirmed. On failure: set gpsFailed
  // so the pill label can change from "Locating…" to "Adjust pin".
  function tryBrowserGeolocation() {
    if (!("geolocation" in navigator)) {
      setGpsFailed(true);
      return;
    }
    setGpsLocating(true);
    setGpsFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          locationSource: "GPS_API", // FIX-13: browser GPS API, canonical value
          gpsConfirmed: true,
        }));
        setGpsLocating(false);
      },
      () => {
        // Geo denied or timed out — leave coords at default, signal user to adjust
        setGpsLocating(false);
        setGpsFailed(true);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  // BUG-3 / BUG-4: Fetch ward and nearby road for current coordinates.
  // Re-runs whenever lat/lng changes (e.g. after pin adjustment).
  // Gracefully degrades on 404 or network error.
  useEffect(() => {
    if (step !== "confirm") return;
    setWardLabel(null);
    setWardLoading(true);
    setNearRoad(null);

    const controller = new AbortController();

    // Ward lookup
    fetch(
      `${API_BASE_URL}/api/wards/lookup?lat=${form.lat}&lng=${form.lng}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ ward_number: number; ward_name: string }>;
      })
      .then((data) => {
        if (data) {
          setWardLabel(`Ward ${data.ward_number} · ${data.ward_name}`);
        }
        setWardLoading(false);
      })
      .catch(() => {
        // Network error or aborted — degrade silently
        setWardLoading(false);
      });

    // BUG-4: Nominatim reverse geocoding for nearby road name.
    // Nominatim ToS requires a descriptive User-Agent header.
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${form.lat}&lon=${form.lng}&format=json`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Walkable BLR (staging-walkability.kinariwala.com)",
        },
      }
    )
      .then((r) => r.json())
      .then((data: { address?: { road?: string; suburb?: string; neighbourhood?: string } }) => {
        const road =
          data.address?.road ??
          data.address?.suburb ??
          data.address?.neighbourhood ??
          null;
        setNearRoad(road);
      })
      .catch(() => {
        // Silent fail — near road is optional context, not critical
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.lat, form.lng]);

  // On mount: check if home page ReportCTA stored a pending photo
  // If found, skip the photo step and go directly to category
  useEffect(() => {
    const pending = consumePendingPhoto();
    if (!pending) return;
    setPhotoPreviewUrl(pending.previewUrl);
    setForm((f) => ({
      ...f,
      file: pending.file,
      lat: pending.lat ?? f.lat,
      lng: pending.lng ?? f.lng,
      locationSource: pending.locationSource,
      gpsConfirmed: pending.gpsConfirmed,
      photoTime: pending.photoTime ?? new Date(),
    }));
    setCameFromCTA(true);
    setStep("category");
    // BUG-2: If the pending photo had no GPS, start browser geo concurrently
    if (!pending.gpsConfirmed) {
      tryBrowserGeolocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  async function handleFile(file: File) {
    setError(null);
    setPhotoProcessing(true);
    // Reset geo state for a new photo
    setGpsLocating(false);
    setGpsFailed(false);

    // Preview from original for responsiveness
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));

    // EXIF extraction on ORIGINAL file (Phase 02.2 decision — canvas re-encoding strips EXIF).
    // Compat pattern for exifr@7 UMD + Jest mock (copied verbatim from PhotoCapture.tsx).
    let gps: { latitude: number; longitude: number } | null = null;
    let photoTime: Date | null = null;
    try {
      const exifrModule = require("exifr");
      const exifr = (exifrModule.default ?? exifrModule) as {
        gps: (f: File) => Promise<{ latitude: number; longitude: number } | null>;
        parse: (f: File, opts: Record<string, boolean>) => Promise<Record<string, unknown> | null>;
      };
      // Run GPS and DateTimeOriginal extraction concurrently
      const [gpsResult, exifData] = await Promise.all([
        exifr.gps(file).catch(() => null),
        exifr.parse(file, { DateTimeOriginal: true }).catch(() => null),
      ]);
      if (gpsResult?.latitude && gpsResult?.longitude) {
        gps = { latitude: gpsResult.latitude, longitude: gpsResult.longitude };
      }
      // DateTimeOriginal is a JS Date when exifr parses it
      if (exifData?.DateTimeOriginal instanceof Date) {
        photoTime = exifData.DateTimeOriginal as Date;
      }
    } catch {
      // EXIF failed — GPS and time stay null
    }

    // Fall back to current time if EXIF had no timestamp
    if (!photoTime) {
      photoTime = new Date();
    }

    // Compress if oversized
    let finalFile: File;
    if (file.size > MAX_BYTES) {
      const compressed = await compressImage(file);
      if (!compressed) {
        setPhotoProcessing(false);
        setError("Photo is too large to compress. Please choose a smaller image.");
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

    setPhotoProcessing(false);
    setForm((f) => ({
      ...f,
      file: finalFile,
      lat: gps?.latitude ?? f.lat,
      lng: gps?.longitude ?? f.lng,
      locationSource: gps ? "EXIF_GPS" : "GPS_API", // FIX-13 (D-33): canonical values
      gpsConfirmed: !!gps,
      photoTime,
    }));
    setStep("category");

    // BUG-2: If EXIF produced no GPS, start browser geolocation concurrently.
    // Navigation to "category" is not blocked — this runs in the background.
    if (!gps) {
      tryBrowserGeolocation();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file).catch(() => {
      setPhotoProcessing(false);
      setError("Could not read photo. Please try a different image.");
    });
  }

  function resetAll() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setForm(INITIAL_FORM);
    setStep("photo");
    setCameFromCTA(false);
    setSubmittedReportId(null);
    setError(null);
    setShowAdjustMap(false);
    setGpsLocating(false);
    setGpsFailed(false);
    setWardLabel(null);
    setNearRoad(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleSubmit() {
    if (!form.file) return;
    if (!isInBengaluru(form.lat, form.lng)) {
      setError("Please drop the pin within Bengaluru.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", form.file);
      body.append("lat", String(form.lat));
      body.append("lng", String(form.lng));
      body.append("category", form.category);
      body.append("severity", form.severity);
      body.append("location_source", form.locationSource);
      if (form.description) body.append("description", form.description);
      if (form.name) body.append("name", form.name.slice(0, 100));
      if (form.contact) body.append("contact", form.contact.slice(0, 200));
      // ABUSE-02 honeypot: read value from the off-screen input (MUST remain in DOM)
      const honeypotEl = document.querySelector(
        'input[data-hp="1"]'
      ) as HTMLInputElement | null;
      body.append("website", honeypotEl?.value ?? "");

      const res = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Server error ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      setSubmittedReportId(data.id ?? null);
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render branches ───

  // Success
  if (submittedReportId !== null) {
    return (
      <main
        style={{
          maxWidth: 428,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
        }}
      >
        <SuccessCard
          reportId={submittedReportId ?? undefined}
          locationLabel={nearRoad ?? undefined}
          wardLabel={wardLabel ?? undefined}
          onReportAnother={() => { window.location.href = "/"; }}
          onClose={() => {
            window.location.href = "/";
          }}
        />
      </main>
    );
  }

  // Step 0: Photo
  if (step === "photo") {
    return (
      <main
        style={{
          maxWidth: 428,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          padding: 20,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Link href="/" aria-label="Back to home" style={{ color: "var(--ink)" }}>
            <Icon name="arrow_left" size={24} />
          </Link>
        </div>
        <SectionLabel style={{ marginBottom: 8 }}>Step 1 · Photo</SectionLabel>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "var(--ink)" }}>
          <Bi en="Take a photo" kn="ಫೋಟೋ ತೆಗೆಯಿರಿ" />
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--muted)",
            marginTop: 8,
            marginBottom: 20,
          }}
        >
          Photograph the issue clearly.
        </p>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>
        )}

        {/* Take Photo — label-wrapped input triggers iOS camera directly (Phase 02.3 pattern) */}
        <label
          className="press"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "var(--accent)",
            color: "#fff",
            padding: "40px 20px",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-md)",
            cursor: "pointer",
            minHeight: 128,
            fontWeight: 600,
            position: "relative",
          }}
        >
          <Icon name="camera" size={40} />
          <Bi
            en="Take Photo"
            kn="ಫೋಟೋ ತೆಗೆಯಿರಿ"
            style={{ fontSize: 18, fontWeight: 600, alignItems: "center" }}
          />
          <input
            ref={cameraRef}
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
            onChange={handleInputChange}
          />
        </label>

        {/* Upload from Gallery — label without capture opens photo library */}
        <label
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "var(--surface)",
            color: "var(--ink)",
            padding: "18px 20px",
            borderRadius: "var(--r-xl)",
            border: "1px solid var(--border-strong)",
            marginTop: 12,
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Icon name="image" size={20} />
          <Bi
            en="Upload from Gallery"
            kn="ಗ್ಯಾಲರಿಯಿಂದ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ"
            style={{ alignItems: "center" }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
            onChange={handleInputChange}
          />
        </label>

        {photoProcessing && (
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
            Processing…
          </p>
        )}

        {/* ABUSE-02 honeypot — type="text" so bots fill it; visually hidden via absolute positioning */}
        <input
          type="text"
          name="website"
          data-hp="1"
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />
      </main>
    );
  }

  // Step 1: Category
  if (step === "category") {
    const canContinue = !!form.category;
    return (
      <main
        style={{
          maxWidth: 428,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 16px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => { if (cameFromCTA) router.push("/"); else resetAll(); }}
            className="press"
            aria-label="Back"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: "none",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <Icon name="arrow_left" size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              Pick a category
            </div>
            <SectionLabel>Step 1 of 2</SectionLabel>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            <div
              style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }}
              aria-hidden="true"
            />
            <div
              style={{ width: 20, height: 3, borderRadius: 2, background: "var(--border-strong)" }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className="no-scrollbar"
          style={{ flex: 1, overflowY: "auto", padding: "16px 16px 140px" }}
        >
          {/* Photo review strip — BUG-2: Retake button added as sibling to content div */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
            }}
          >
            {photoPreviewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photoPreviewUrl}
                alt="Captured photo"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "var(--r-md)",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <SectionLabel>Photo ready</SectionLabel>
              {form.gpsConfirmed ? (
                <Pill tone="accent" style={{ marginTop: 4 }}>
                  <span
                    className="pulse"
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}
                  />
                  <span className="mono" style={{ fontSize: 12 }}>
                    {form.lat.toFixed(3)}, {form.lng.toFixed(3)}
                  </span>
                </Pill>
              ) : gpsLocating ? (
                /* BUG-2: browser geo is in-flight */
                <Pill tone="neutral" style={{ marginTop: 4 }}>
                  <span
                    className="pulse"
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }}
                  />
                  Locating…
                </Pill>
              ) : gpsFailed ? (
                /* BUG-2: geo denied or timed out — prompt user to adjust */
                <Pill tone="neutral" style={{ marginTop: 4 }}>
                  <span
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }}
                  />
                  Adjust pin
                </Pill>
              ) : (
                /* Initial state before geo attempt resolves */
                <Pill tone="neutral" style={{ marginTop: 4 }}>
                  <span
                    className="pulse"
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }}
                  />
                  Locating…
                </Pill>
              )}
            </div>
            {/* BUG-2: Retake button — returns user to photo step */}
            <button
              type="button"
              onClick={resetAll}
              style={{
                color: "var(--muted)",
                fontSize: 11,
                padding: "6px 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                whiteSpace: "nowrap",
                background: "transparent",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Retake
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "var(--ink)" }}>
              <Bi en="What's the issue?" kn="ಸಮಸ್ಯೆ ಯಾವುದು?" />
            </h2>
          </div>

          <div style={{ marginTop: 14 }}>
            <CategoryGrid
              value={form.category}
              onChange={(cat) => setForm((f) => ({ ...f, category: cat }))}
            />
          </div>
        </div>

        {/* Sticky Continue CTA */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, var(--bg) 60%, transparent)",
            padding: "16px 16px max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <Btn
            variant="accent"
            size="xl"
            disabled={!canContinue}
            onClick={() => setStep("confirm")}
            style={{ width: "100%" }}
          >
            <Bi en="Continue" kn="ಮುಂದುವರಿಸಿ" style={{ alignItems: "center" }} />
            <Icon name="arrow_right" size={20} />
          </Btn>
        </div>

        {/* ABUSE-02 honeypot — type="text" so bots fill it; visually hidden via absolute positioning */}
        <input
          type="text"
          name="website"
          data-hp="1"
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />
      </main>
    );
  }

  // Step 2: Confirm
  const outOfBounds = !isInBengaluru(form.lat, form.lng);
  return (
    <main
      style={{
        maxWidth: 428,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => setStep("category")}
          className="press"
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "none",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <Icon name="arrow_left" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            Confirm &amp; submit
          </div>
          <SectionLabel>Step 2 of 2</SectionLabel>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <div
            style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }}
            aria-hidden="true"
          />
          <div
            style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="no-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "16px 16px 140px" }}
      >
        {/* Review card — BUG-3: Kannada category name + photo timestamp */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
          }}
        >
          {photoPreviewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoPreviewUrl}
              alt="Captured photo"
              style={{
                width: 72,
                height: 72,
                borderRadius: "var(--r-md)",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SectionLabel>Reporting</SectionLabel>
            {/* BUG-3 Part A: Show both English and Kannada category name */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginTop: 2,
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {form.category ? (
                <Bi
                  en={getCategoryLabel(form.category).en}
                  kn={getCategoryLabel(form.category).kn}
                  style={{ flexDirection: "row", gap: 6, alignItems: "baseline" }}
                />
              ) : "—"}
            </div>
            {/* BUG-3 Part B: Photo timestamp */}
            {form.photoTime && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  marginTop: 4,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {form.photoTime.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Just now
              </div>
            )}
          </div>
        </div>

        {/* Location section */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <SectionLabel>Location · ಸ್ಥಳ</SectionLabel>
            {form.gpsConfirmed && (
              <Pill tone="accent">
                <span
                  className="pulse"
                  style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}
                />
                GPS confirmed
              </Pill>
            )}
          </div>
          {showAdjustMap ? (
            <LocationMap
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => {
                setForm((f) => ({
                  ...f,
                  lat,
                  lng,
                  locationSource: "MANUAL_ADJUST", // FIX-13: was "manual_pin"
                  gpsConfirmed: false,
                }));
              }}
            />
          ) : (
            <div
              className="map-tile"
              style={{
                height: 120,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setShowAdjustMap(true)}
                className="press"
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid var(--border)",
                  padding: "6px 10px",
                  borderRadius: "var(--r-full)",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <Icon name="crosshair" size={12} /> Adjust
              </button>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 12,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>
              {form.lat.toFixed(3)}° N, {form.lng.toFixed(3)}° E
            </span>
          </div>

          {/* BUG-4: Styled GBA ward card replacing plain text */}
          {!wardLoading && wardLabel && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  background: "var(--surface-2)",
                  padding: "3px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                GBA
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {wardLabel}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    marginTop: 1,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Auto-detected
                </div>
              </div>
              <Icon
                name="check_circle"
                size={16}
                style={{ color: "var(--accent-ink)", flexShrink: 0 }}
              />
            </div>
          )}

          {/* BUG-4: Nearby road from Nominatim */}
          {nearRoad && (
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>
              Near {nearRoad}
            </div>
          )}

          {outOfBounds && (
            <p style={{ color: "var(--danger)", fontSize: 14, marginTop: 8 }}>
              Please drop the pin within Bengaluru.
            </p>
          )}
        </div>

        {/* Severity */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Severity · ತೀವ್ರತೆ</SectionLabel>
          <SeverityGrid
            value={form.severity}
            onChange={(s) => setForm((f) => ({ ...f, severity: s }))}
          />
        </div>

        {/* Optional note */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <SectionLabel>Note · ಟಿಪ್ಪಣಿ</SectionLabel>
            <Pill tone="neutral">Optional</Pill>
          </div>
          <textarea
            rows={3}
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Add context for the reviewer…"
            style={{
              width: "100%",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: 12,
              fontSize: 14,
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
              resize: "none",
              outline: "none",
            }}
          />
        </div>

        {/* Contact accordion — collapsed by default, expands on click */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowContact((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowContact((v) => !v); }}
          aria-expanded={showContact}
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "14px 4px",
            fontSize: 14,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="shield" size={16} />
            Add contact for follow-up (private)
          </span>
          <Icon
            name="chevron_down"
            size={16}
            style={{
              transform: showContact ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
        {showContact && (
          <div
            style={{
              padding: "12px 0 4px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div>
              <label
                htmlFor="contact-name"
                style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}
              >
                Name (optional)
              </label>
              <input
                id="contact-name"
                type="text"
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--ink)",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label
                htmlFor="contact-email"
                style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}
              >
                Contact email or phone (private)
              </label>
              <input
                id="contact-email"
                type="text"
                maxLength={200}
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="email@example.com or +91 9876543210"
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--ink)",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14, marginTop: 12 }}>{error}</p>
        )}
      </div>

      {/* Sticky Submit CTA */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(to top, var(--bg) 60%, transparent)",
          padding: "16px 16px max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <Btn
          variant="accent"
          size="xl"
          disabled={submitting || outOfBounds}
          onClick={handleSubmit}
          style={{ width: "100%" }}
        >
          <Icon name="send" size={18} />
          <Bi
            en={submitting ? "Submitting…" : "Submit report"}
            kn={submitting ? undefined : "ವರದಿ ಸಲ್ಲಿಸಿ"}
            style={{ alignItems: "center" }}
          />
        </Btn>
      </div>

      {/* ABUSE-02 honeypot — type="text" so bots fill it; visually hidden via absolute positioning */}
      <input
        type="text"
        name="website"
        data-hp="1"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        style={{ opacity: 0, position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />
    </main>
  );
}
