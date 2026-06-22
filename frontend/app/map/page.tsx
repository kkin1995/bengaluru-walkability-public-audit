"use client";

import { useState } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import type { FeatureCollection } from "geojson";
import { API_BASE_URL, PUBLIC_WARD_BOUNDARIES_URL } from "@/app/lib/config";
import { publicStatusLabel } from "@/app/lib/translations";
import { Icon } from "@/app/components/ui/Icon";
import { Btn } from "@/app/components/ui/Btn";

// TRIAGE-03: ReportLite now carries status for client-side status filtering (D-11).
type ReportLite = { category: string; status: string };

const CHIPS = [
  { label: "All",      value: "all" },
  { label: "Damaged",  value: "broken_footpath" },
  { label: "Blocked",  value: "blocked_footpath" },
  { label: "No path",  value: "no_footpath" },
  { label: "Crossing", value: "unsafe_crossing" },
  { label: "Lighting", value: "poor_lighting" },
  { label: "Other",    value: "other" },
] as const;

// TRIAGE-03 (D-07): 4-chip status row — 6-state backend enum collapsed to 3 citizen buckets.
// "In progress" matches: acknowledged | assigned | in_progress (per CONTEXT.md D-07 + Specifics).
// Labels use publicStatusLabel where applicable (D-07 requirement — no hardcoded citizen text).
const STATUS_CHIPS = [
  { value: "all",         label: "All statuses",           dot: null },
  { value: "open",        label: publicStatusLabel("open"),        dot: "var(--danger)" },
  { value: "in_progress", label: publicStatusLabel("in_progress"), dot: "var(--warn)" },
  { value: "resolved",    label: publicStatusLabel("resolved"),    dot: "var(--accent)" },
] as const;

// Returns true when a report's status matches the selected status chip bucket (D-07 mapping).
function statusMatch(reportStatus: string, chipValue: string): boolean {
  if (chipValue === "all") return true;
  if (chipValue === "open")
    return reportStatus === "open" || reportStatus === "acknowledged" || reportStatus === "assigned";
  if (chipValue === "in_progress")
    return reportStatus === "acknowledged" || reportStatus === "assigned" || reportStatus === "in_progress";
  if (chipValue === "resolved")
    return reportStatus === "resolved" || reportStatus === "closed";
  return false;
}

function chipLabel(
  chip: (typeof CHIPS)[number],
  counts: Record<string, number>,
  total: number
): string {
  if (chip.value === "all") {
    return total > 0 ? `All · ${total}` : "All";
  }
  // WR-04: use ?? 0 so zero-count categories still show "Label · 0" per spec
  const n = counts[chip.value] ?? 0;
  return `${chip.label} · ${n}`;
}

// TRIAGE-03 (D-10): Status counts are TOTAL counts (not cross-filtered by category).
function statusCounts(reports: ReportLite[]): Record<string, number> {
  let open = 0; let inProgress = 0; let resolved = 0;
  for (const r of reports) {
    const s = r.status;
    if (s === "open" || s === "acknowledged" || s === "assigned") open++;
    else if (s === "in_progress") inProgress++;
    else if (s === "resolved" || s === "closed") resolved++;
  }
  return { open, in_progress: inProgress, resolved };
}

// Leaflet requires `window` — ssr: false is mandatory (do not remove even in client component).
const ReportsMap = nextDynamic(() => import("../components/ReportsMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("all");
  const [allReports, setAllReports] = useState<ReportLite[]>([]);

  // TRIAGE-04: Ward boundary overlay state
  const [showWardBoundaries, setShowWardBoundaries] = useState(false);
  const [wardBoundariesGeojson, setWardBoundariesGeojson] = useState<FeatureCollection | null>(null);
  const [wardBoundariesStatus, setWardBoundariesStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  const counts = allReports.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  const total = allReports.length;

  const sCounts = statusCounts(allReports);

  // TRIAGE-04: Toggle ward boundary overlay. Lazily fetches GeoJSON on first ON toggle;
  // reuses cache on subsequent toggles. Silent-fails on error (D-21).
  async function handleWardToggle() {
    if (showWardBoundaries) {
      // ON → OFF
      setShowWardBoundaries(false);
      return;
    }
    // OFF → ON
    if (wardBoundariesGeojson) {
      // Already cached — reuse without refetch (D-20)
      setShowWardBoundaries(true);
      return;
    }
    // First time: fetch lazily
    setWardBoundariesStatus("loading");
    try {
      const res = await fetch(PUBLIC_WARD_BOUNDARIES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson: FeatureCollection = await res.json();
      setWardBoundariesGeojson(geojson);
      setWardBoundariesStatus("loaded");
      setShowWardBoundaries(true);
    } catch {
      // D-21: silent fail — no user-facing error message
      setWardBoundariesStatus("error");
      setShowWardBoundaries(false);
    }
  }

  const wardToggleDisabled = wardBoundariesStatus === "loading" || wardBoundariesStatus === "error";

  return (
    <main
      style={{
        height: "100dvh",
        position: "relative",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Map fills entire screen behind overlays */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ReportsMap
          apiUrl={API_BASE_URL}
          categoryFilter={activeFilter === "all" ? undefined : activeFilter}
          statusFilter={activeStatusFilter}
          onReportsLoaded={setAllReports}
          showWardBoundaries={showWardBoundaries}
          wardBoundariesGeojson={wardBoundariesGeojson}
        />
      </div>

      {/* Top overlay bar: back + location pill + filter */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          gap: 8,
          zIndex: 500,
        }}
      >
        <Link
          href="/"
          className="press"
          aria-label="Back to home"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          <Icon name="arrow_left" size={20} />
        </Link>
        <div
          role="search"
          style={{
            flex: 1,
            minWidth: 0,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-full)",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
          }}
        >
          <Icon name="pin" size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ink-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Bengaluru
          </div>
        </div>
        {/* WR-03: filter icon is deferred — rendered as non-interactive div */}
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            color: "var(--ink)",
            cursor: "default",
            pointerEvents: "none",
          }}
        >
          <Icon name="filter" size={18} />
        </div>
      </div>

      {/* Chip filter strip — row 1: category — always visible, horizontally scrollable, D-13/D-14/D-15 */}
      <div
        role="toolbar"
        aria-label="Filter by category"
        className="no-scrollbar"
        style={{
          position: "absolute",
          top: 76,
          left: 0,
          right: 0,
          zIndex: 500,
          padding: "0 16px",
          overflowX: "auto",
          display: "flex",
          gap: 8,
          paddingBottom: 4,
        }}
      >
        {CHIPS.map((chip) => {
          const active = activeFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              className="press"
              aria-pressed={active}
              onClick={() => setActiveFilter(chip.value)}
              style={
                active
                  ? {
                      height: 36,
                      padding: "0 14px",
                      borderRadius: "var(--r-full)",
                      whiteSpace: "nowrap" as const,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                      border: "none",
                      background: "var(--ink)",
                      color: "#fafaf9",
                    }
                  : {
                      height: 36,
                      padding: "0 14px",
                      borderRadius: "var(--r-full)",
                      whiteSpace: "nowrap" as const,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.9)",
                      color: "var(--ink-2)",
                      backdropFilter: "blur(8px)",
                      boxShadow: "var(--shadow-sm)",
                    }
              }
            >
              {chipLabel(chip, counts, total)}
            </button>
          );
        })}
      </div>

      {/* TRIAGE-03: Chip filter strip — row 2: status (D-06, D-07, D-08) */}
      {/* top: 120 = 76 (row 1 top) + 36 (chip height) + 8 (gap) */}
      <div
        role="toolbar"
        aria-label="Filter by status"
        className="no-scrollbar"
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          zIndex: 500,
          padding: "0 16px",
          overflowX: "auto",
          display: "flex",
          gap: 8,
          paddingBottom: 4,
        }}
      >
        {STATUS_CHIPS.map((chip) => {
          const active = activeStatusFilter === chip.value;
          const chipCount =
            chip.value === "all"
              ? total
              : chip.value === "open"
              ? sCounts.open
              : chip.value === "in_progress"
              ? sCounts.in_progress
              : sCounts.resolved;
          const label =
            chip.value === "all"
              ? `All statuses · ${chipCount}`
              : `${chip.label} · ${chipCount}`;
          return (
            <button
              key={chip.value}
              type="button"
              className="press"
              aria-pressed={active}
              onClick={() => setActiveStatusFilter(chip.value)}
              style={
                active
                  ? {
                      height: 36,
                      padding: "0 14px",
                      borderRadius: "var(--r-full)",
                      whiteSpace: "nowrap" as const,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                      border: "none",
                      background: "var(--ink)",
                      color: "#fafaf9",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }
                  : {
                      height: 36,
                      padding: "0 14px",
                      borderRadius: "var(--r-full)",
                      whiteSpace: "nowrap" as const,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.9)",
                      color: "var(--ink-2)",
                      backdropFilter: "blur(8px)",
                      boxShadow: "var(--shadow-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }
              }
            >
              {chip.dot && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: chip.dot,
                    flexShrink: 0,
                    ...(active ? { boxShadow: "0 0 0 1.5px rgba(255,255,255,0.25)" } : {}),
                  }}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* TRIAGE-04: "Ward boundaries · 369 wards" banner — shown below search bar when overlay is ON */}
      {showWardBoundaries && (
        <div
          style={{
            position: "absolute",
            top: 166,
            left: 16,
            right: 16,
            zIndex: 500,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--r-md)",
            padding: "5px 12px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            color: "var(--accent)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          aria-live="polite"
        >
          <span
            style={{
              width: 12,
              height: 2,
              background: "var(--accent)",
              opacity: 0.6,
              flexShrink: 0,
              borderRadius: 1,
            }}
          />
          Ward boundaries · 369 wards
        </div>
      )}

      {/* Status legend (UI-SPEC §H) — replaces old category-based legend */}
      <div
        role="region"
        aria-label="Status legend"
        style={{
          position: "absolute",
          top: 200,
          left: 12,
          zIndex: 500,
          background: "rgba(255,255,255,0.95)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "8px 12px",
          fontSize: 10,
          fontWeight: 400,
          backdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", flexShrink: 0 }} />
          <span>Open</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warn)", flexShrink: 0 }} />
          <span>In progress</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
          <span>Resolved</span>
        </div>
      </div>

      {/* TRIAGE-04: FAB column — Ward toggle button stacked above Report here FAB (D-18) */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(24px + env(safe-area-inset-bottom))",
          right: 16,
          zIndex: 500,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        {/* Ward boundaries toggle button (52x52px, D-18 spec) */}
        <button
          type="button"
          aria-pressed={showWardBoundaries}
          aria-label="Toggle ward boundaries"
          disabled={wardToggleDisabled}
          onClick={handleWardToggle}
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--r-lg)",
            border: showWardBoundaries
              ? "none"
              : "1px solid var(--border)",
            background: showWardBoundaries
              ? "var(--accent)"
              : "rgba(255,255,255,0.95)",
            color: showWardBoundaries ? "#ffffff" : "var(--ink)",
            backdropFilter: showWardBoundaries ? "none" : "blur(8px)",
            boxShadow: "var(--shadow-md)",
            cursor: wardToggleDisabled ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            opacity: wardBoundariesStatus === "loading"
              ? 0.5
              : wardBoundariesStatus === "error"
              ? 0.4
              : 1,
            transition: "opacity 0.2s, background 0.2s",
          }}
        >
          {/* Ward grid icon (20px) — inline SVG for no-dependency */}
          <svg
            width={20}
            height={20}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span
            style={{
              fontSize: 8,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            WARDS
          </span>
        </button>

        {/* Report here FAB — FIX-03 (D-06): href changed from /report to / */}
        <Link
          href="/"
          style={{ textDecoration: "none" }}
        >
          <Btn
            variant="accent"
            size="lg"
            style={{
              borderRadius: "var(--r-full)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <Icon name="camera" size={18} />
            <span style={{ whiteSpace: "nowrap" }}>Report here</span>
          </Btn>
        </Link>
      </div>
    </main>
  );
}
