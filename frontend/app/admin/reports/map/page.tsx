"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getAdminReports } from "../../lib/adminApi";
import type { AdminReport } from "../../lib/adminApi";
import { BENGALURU_CENTER } from "../../../lib/constants";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { Pill } from "../../components/Pill";
import { Card } from "../../components/Card";
import { Btn } from "../../components/Btn";

// ── Pure color functions ───────────────────────────────────────────────────────

/**
 * Maps report status to a hex color for use in Leaflet divIcon HTML.
 * These values are intentionally hex (not CSS vars) to work inside Leaflet's
 * inline HTML injection which does not have access to CSS custom properties.
 * Exported for test verification.
 */
function getPinColor(status: string): string {
  switch (status) {
    case "submitted":
      return "#6B7280";
    case "under_review":
      return "#F59E0B";
    case "resolved":
      return "#22C55E";
    default:
      return "#6B7280";
  }
}

/** Maps report status to a CSS variable string for legend/chip rendering. */
function getStatusCssColor(status: string): string {
  switch (status) {
    case "submitted":
      return "var(--status-submitted)";
    case "under_review":
      return "var(--status-review)";
    case "resolved":
      return "var(--status-resolved)";
    default:
      return "var(--status-submitted)";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getUTCDate().toString().padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function truncateDescription(desc: string | null): string {
  if (desc === null) {
    return "No description provided.";
  }
  if (desc.length > 100) {
    return desc.slice(0, 100) + "…";
  }
  return desc;
}

// ── Leaflet components — loaded dynamically (no SSR) ─────────────────────────

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

// ── Filter options ────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "no_footpath", label: "No Footpath" },
  { value: "broken_footpath", label: "Broken Footpath" },
  { value: "blocked_footpath", label: "Blocked Footpath" },
  { value: "unsafe_crossing", label: "Unsafe Crossing" },
  { value: "poor_lighting", label: "Poor Lighting" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolved" },
];

type StatusFilter = "" | "submitted" | "under_review" | "resolved";

const STATUS_CHIP_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "ALL" },
  { value: "submitted", label: "SUBMITTED" },
  { value: "under_review", label: "REVIEW" },
  { value: "resolved", label: "RESOLVED" },
];

// ── Main page component ────────────────────────────────────────────────────────

export default function ReportsMapPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const isOnline = useOnlineStatus();

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await getAdminReports({ limit: 200, page: 1 });
      setReports(result.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("401")) {
        routerRef.current.push("/admin/login");
        return;
      }
      setFetchError("Failed to load reports. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Client-side filtering (AND logic)
  const filteredReports = reports.filter((r) => {
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const center: [number, number] = [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng];

  // ── Offline banner ─────────────────────────────────────────────────────────
  const offlineBanner = !isOnline ? (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--warn-bg)",
        border: "1px solid var(--warn-border)",
        borderRadius: "var(--r-md)",
        padding: "10px 16px",
        marginBottom: 16,
        color: "var(--warn-ink)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.01em",
      }}
    >
      <strong>{"You're offline right now."}</strong>{" "}
      {"Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online."}
    </div>
  ) : null;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: "32px 32px", maxWidth: 1400, marginLeft: "auto", marginRight: "auto" }}>
        {offlineBanner}
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          Loading reports...
        </p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={{ padding: "32px 32px", maxWidth: 1400, marginLeft: "auto", marginRight: "auto" }}>
        {offlineBanner}
        <Card role="alert" style={{ marginBottom: 16 }}>
          <p style={{ color: "var(--danger-ink)", fontFamily: "var(--font-sans)", fontSize: 14, margin: 0 }}>
            {fetchError}
          </p>
        </Card>
        <Btn variant="accent" size="md" onClick={loadReports} aria-label="Retry loading reports">
          Retry
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {/* ── Offline banner ───────────────────────────────────────────────── */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: "var(--warn-bg)",
            border: "1px solid var(--warn-border)",
            padding: "8px 16px",
            color: "var(--warn-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          {"You're offline right now. Changes saved locally."}
        </div>
      )}

      {/* ── Floating top bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Pill tone="outline" size="sm" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
          {String(filteredReports.length)} REPORTS
        </Pill>
      </div>

      {/* ── Filter controls (hidden selects for accessibility + test compatibility) ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {/* Category filter select — accessible, visible */}
        <div>
          <label htmlFor="category-filter" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Category
          </label>
          <select
            id="category-filter"
            name="category"
            aria-label="Category filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-xs)",
              padding: "5px 8px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              background: "var(--surface)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter select — accessible, visible */}
        <div>
          <label htmlFor="status-filter" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Status
          </label>
          <select
            id="status-filter"
            name="status"
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-xs)",
              padding: "5px 8px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              background: "var(--surface)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status chip buttons — visual Direction B treatment */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flexWrap: "nowrap" }}>
          {STATUS_CHIP_OPTIONS.map((f) => {
            const isActive = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: "var(--r-xs)",
                  border: isActive
                    ? "1px solid var(--ink)"
                    : "1px solid var(--border-strong)",
                  background: isActive ? "var(--ink)" : "transparent",
                  color: isActive ? "var(--bg)" : "var(--ink-2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.value && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: getStatusCssColor(f.value),
                      flexShrink: 0,
                    }}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        {(categoryFilter || statusFilter) && (
          <button
            onClick={() => {
              setCategoryFilter("");
              setStatusFilter("");
            }}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xs)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Map container ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Empty states */}
        {reports.length === 0 && (
          <div style={{ padding: "16px", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            No reports found.
          </div>
        )}
        {reports.length > 0 && filteredReports.length === 0 && (
          <div style={{ padding: "16px", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            No reports match the current filters.
          </div>
        )}

        <div data-testid="admin-reports-map" style={{ height: "100%", width: "100%" }}>
          <MapContainer
            center={center}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {filteredReports.map((report) => {
              // Use L.divIcon with MapPin-style HTML (status-colored circle dot)
              const pinColor = getPinColor(report.status);
              const iconHtml = `<div style="width:14px;height:14px;border-radius:999px;background:${pinColor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`;
              // We use a lazy import for L to avoid SSR issues
              let icon: unknown;
              if (typeof window !== "undefined") {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  const L = require("leaflet");
                  if (typeof L.divIcon === "function") {
                    icon = L.divIcon({
                      html: iconHtml,
                      className: "",
                      iconSize: [14, 14],
                      iconAnchor: [7, 7],
                    });
                  }
                } catch {
                  // leaflet not available (test env) — use default marker icon
                }
              }

              return (
                <Marker
                  key={report.id}
                  position={[report.latitude, report.longitude]}
                  icon={icon as any}
                >
                  <Popup>
                    <div style={{ fontFamily: "var(--font-sans, sans-serif)", fontSize: 13, minWidth: 180 }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{report.category}</p>
                      <p style={{ margin: "0 0 4px" }}>
                        <span style={{ color: pinColor, fontWeight: 600 }}>{report.status}</span>
                      </p>
                      <p style={{ margin: "0 0 4px", color: "#888", fontSize: 11 }}>
                        {formatDate(report.created_at)}
                      </p>
                      <p style={{ margin: 0, color: "#555" }}>
                        {truncateDescription(report.description)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* ── Map legend: frosted-glass chip at bottom-left ────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 1000,
            backdropFilter: "blur(8px)",
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "var(--r-md, 8px)",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {[
            { label: "SUBMITTED", color: getStatusCssColor("submitted") },
            { label: "REVIEW",    color: getStatusCssColor("under_review") },
            { label: "RESOLVED",  color: getStatusCssColor("resolved") },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "var(--ink, #0a0a0a)",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
