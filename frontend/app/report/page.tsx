"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import PhotoCapture from "../components/PhotoCapture";
import CategoryPicker from "../components/CategoryPicker";
import SubmitSuccess from "../components/SubmitSuccess";
import { BENGALURU_BOUNDS, BENGALURU_CENTER } from "../lib/constants";

// react-leaflet uses window — must disable SSR
const LocationMap = dynamic(() => import("../components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 text-sm">
      Loading map…
    </div>
  ),
});

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

const STEPS = ["Photo", "Location", "Category", "Details"];

const SEVERITY_HINTS: Record<string, string> = {
  low: "Inconvenient but passable",
  medium: "Difficult or risky for some pedestrians",
  high: "Immediate danger — open pit, no path, safety risk",
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
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
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
  });

  function handlePhoto(file: File, gps: { latitude: number; longitude: number } | null) {
    if (gps) {
      setForm((f) => ({
        ...f,
        file,
        lat: gps.latitude,
        lng: gps.longitude,
        locationSource: "exif",
        gpsConfirmed: true,
      }));
    } else {
      setForm((f) => ({
        ...f,
        file,
        locationSource: "manual_pin",
        gpsConfirmed: false,
      }));
    }
    // Auto-advance to location step
    setStep(1);
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return !!form.file;
      case 1: return !!(form.lat && form.lng) && isInBengaluru(form.lat, form.lng);
      case 2: return !!form.category;
      case 3: return true;
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!form.file) return;
    setSubmitting(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
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

      const res = await fetch(`${apiUrl}/api/reports`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Server error ${res.status}`);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
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
    });
    setStep(0);
    setSubmitted(false);
    setError(null);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-white">
        <SubmitSuccess onReset={resetForm} />
      </main>
    );
  }

  // Show out-of-bounds error whenever lat/lng falls outside Bengaluru on the location step.
  // Initial coordinates are set to BENGALURU_CENTER so this never fires on first render.
  const outOfBounds = step === 1 && !isInBengaluru(form.lat, form.lng);

  return (
    <main className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">Report an Issue</h1>
          <p className="text-xs text-gray-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 py-6">
        {/* Step 0: Photo */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Take a photo</h2>
            <p className="text-gray-500 text-sm">
              Photograph the pedestrian infrastructure issue clearly.
            </p>
            <PhotoCapture onPhoto={handlePhoto} />
          </div>
        )}

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Confirm location</h2>
            {form.gpsConfirmed ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Location found from photo ✓
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Couldn&apos;t read location from photo — drop the pin below
                </span>
              </div>
            )}
            <LocationMap
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) =>
                setForm((f) => ({ ...f, lat, lng, locationSource: "manual_pin", gpsConfirmed: false }))
              }
            />
            {outOfBounds ? (
              <p className="text-red-600 text-xs text-center font-medium">
                Please drop the pin within Bengaluru
              </p>
            ) : (
              <p className="text-xs text-gray-400 text-center">
                Tap the map or drag the pin to adjust
              </p>
            )}
          </div>
        )}

        {/* Step 2: Category */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">What&apos;s the issue?</h2>
            <p className="text-gray-500 text-sm">Select the best matching category.</p>
            <CategoryPicker
              value={form.category}
              onChange={(cat) => setForm((f) => ({ ...f, category: cat }))}
            />
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Add details</h2>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border-2 transition-colors ${
                      form.severity === s
                        ? s === "high"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : s === "medium"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {SEVERITY_HINTS[form.severity]}
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Describe the issue in more detail…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">
                {form.description.length}/500
              </p>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Your name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value.slice(0, 100) }))
                }
                placeholder="Anon Citizen"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Contact */}
            <div>
              <label
                htmlFor="contact"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Contact (email/phone){" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="contact"
                type="text"
                value={form.contact}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact: e.target.value.slice(0, 200) }))
                }
                placeholder="For follow-up only, never published"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <footer className="px-4 pb-8 pt-4 border-t border-gray-100">
        {error && (
          <p className="text-red-600 text-sm mb-3 text-center">{error}</p>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-2xl transition-colors"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !canAdvance()}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-2xl transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Report"
            )}
          </button>
        )}
      </footer>
    </main>
  );
}
