"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { API_BASE_URL } from "@/app/lib/config";
import { BENGALURU_BOUNDS, BENGALURU_CENTER } from "@/app/lib/constants";
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
  locationSource: "exif" | "manual_pin";
  gpsConfirmed: boolean;
  category: string;
  severity: string;
  description: string;
  name: string;
  contact: string;
}

const INITIAL_FORM: FormState = {
  file: null,
  lat: BENGALURU_CENTER.lat,
  lng: BENGALURU_CENTER.lng,
  locationSource: "manual_pin",
  gpsConfirmed: false,
  category: "",
  severity: "medium",
  description: "",
  name: "",
  contact: "",
};

const MAX_BYTES = 10 * 1024 * 1024;

function isInBengaluru(lat: number, lng: number): boolean {
  return (
    lat >= BENGALURU_BOUNDS.latMin &&
    lat <= BENGALURU_BOUNDS.latMax &&
    lng >= BENGALURU_BOUNDS.lngMin &&
    lng <= BENGALURU_BOUNDS.lngMax
  );
}

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

export default function ReportPage() {
  const [step, setStep] = useState<Step>("photo");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showAdjustMap, setShowAdjustMap] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setPhotoProcessing(true);

    // Preview from original for responsiveness
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));

    // EXIF extraction on ORIGINAL file (Phase 02.2 decision — canvas re-encoding strips EXIF).
    // Compat pattern for exifr@7 UMD + Jest mock (copied verbatim from PhotoCapture.tsx).
    let gps: { latitude: number; longitude: number } | null = null;
    try {
      const exifrModule = require("exifr");
      const exifr = (exifrModule.default ?? exifrModule) as {
        gps: (f: File) => Promise<{ latitude: number; longitude: number } | null>;
      };
      const result = await exifr.gps(file);
      if (result?.latitude && result?.longitude) {
        gps = { latitude: result.latitude, longitude: result.longitude };
      }
    } catch {
      // EXIF failed — GPS stays null, manual adjust fallback will be offered on confirm screen
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
      locationSource: gps ? "exif" : "manual_pin",
      gpsConfirmed: !!gps,
    }));
    setStep("category");
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
    setSubmittedReportId(null);
    setError(null);
    setShowAdjustMap(false);
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
        'input[name="website"]'
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
      <SuccessCard
        reportId={submittedReportId ?? undefined}
        onReportAnother={resetAll}
        onClose={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  // Step 0: Photo
  if (step === "photo") {
    return (
      <main
        style={{
          minHeight: "100dvh",
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
            className="sr-only"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
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
            className="sr-only"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
            onChange={handleInputChange}
          />
        </label>

        {photoProcessing && (
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
            Processing…
          </p>
        )}

        {/* ABUSE-02 honeypot always present in the DOM */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
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
          minHeight: "100dvh",
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
            onClick={resetAll}
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
          {/* Photo review strip */}
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
                    {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                  </span>
                </Pill>
              ) : (
                <Pill tone="neutral" style={{ marginTop: 4 }}>
                  <span
                    className="pulse"
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }}
                  />
                  Locating…
                </Pill>
              )}
            </div>
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

        {/* ABUSE-02 honeypot */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />
      </main>
    );
  }

  // Step 2: Confirm
  const outOfBounds = !isInBengaluru(form.lat, form.lng);
  return (
    <main
      style={{
        minHeight: "100dvh",
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
        {/* Review card */}
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
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: "var(--ink)" }}>
              {form.category || "—"}
            </div>
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
              onChange={(lat, lng) =>
                setForm((f) => ({
                  ...f,
                  lat,
                  lng,
                  locationSource: "manual_pin",
                  gpsConfirmed: false,
                }))
              }
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
              {form.lat.toFixed(4)}° N, {form.lng.toFixed(4)}° E
            </span>
          </div>
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

        {/* Contact collapse row (display only) */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "14px 4px",
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="shield" size={16} />
            Add contact for follow-up (private)
          </span>
          <Icon name="chevron_down" size={16} />
        </div>

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

      {/* ABUSE-02 honeypot — MUST remain for backend bot detection */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />
    </main>
  );
}
