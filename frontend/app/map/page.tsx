"use client";

import { useState } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { API_BASE_URL } from "@/app/lib/config";
import { Icon } from "@/app/components/ui/Icon";
import { Btn } from "@/app/components/ui/Btn";

type ReportLite = { category: string };

const CHIPS = [
  { label: "All",      value: "all" },
  { label: "Damaged",  value: "broken_footpath" },
  { label: "Blocked",  value: "blocked_footpath" },
  { label: "No path",  value: "no_footpath" },
  { label: "Crossing", value: "unsafe_crossing" },
  { label: "Lighting", value: "poor_lighting" },
  { label: "Other",    value: "other" },
] as const;

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
  const [allReports, setAllReports] = useState<ReportLite[]>([]);

  const counts = allReports.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  const total = allReports.length;

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
          onReportsLoaded={setAllReports}
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

      {/* Chip filter strip — always visible, horizontally scrollable, D-13/D-14/D-15 */}
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

      {/* Status legend (UI-SPEC §H) — replaces old category-based legend */}
      <div
        role="region"
        aria-label="Status legend"
        style={{
          position: "absolute",
          top: 108,
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

      {/* Floating Report here CTA — FIX-03 (D-06): href changed from /report to / */}
      <Link
        href="/"
        style={{
          position: "absolute",
          right: 16,
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          zIndex: 500,
          textDecoration: "none",
        }}
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
    </main>
  );
}
