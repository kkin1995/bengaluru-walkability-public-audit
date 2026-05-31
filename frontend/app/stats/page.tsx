// app/stats/page.tsx — Public walkability statistics page (ANALYTICS-01 / D-08)
//
// Server Component — no "use client". SSR-fetches from public_stats_mv via
// INTERNAL_API_URL. No authentication required.
//
// Revalidates every 60 seconds so the stats refresh without a full redeploy.

import { INTERNAL_API_URL } from "@/app/lib/config";
import { getCategoryLabel } from "@/app/lib/translations";

interface CategoryRow {
  category: string;
  cnt: number;
}

interface PublicStats {
  total_reports: number;
  resolved_count: number;
  top_categories: CategoryRow[] | null;
}

async function fetchStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function StatsPage() {
  const stats = await fetchStats();

  const total = stats?.total_reports ?? 0;
  const resolved = stats?.resolved_count ?? 0;
  const topCats: CategoryRow[] = stats?.top_categories ?? [];
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 16px 64px",
        gap: 40,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Walkability Audit — Open Data
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.5 }}>
          Aggregate statistics from citizen reports of broken and blocked
          footpaths across Bengaluru. Data is updated every 60 seconds.
        </p>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          width: "100%",
          maxWidth: 600,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "20px 24px",
          }}
        >
          <div
            style={{ fontSize: 36, fontWeight: 700, color: "var(--ink)" }}
          >
            {total.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            Total reports
          </div>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "20px 24px",
          }}
        >
          <div
            style={{ fontSize: 36, fontWeight: 700, color: "var(--accent)" }}
          >
            {resolved.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            Resolved ({resolvedPct}%)
          </div>
        </div>
      </div>

      {/* Top 3 categories */}
      {topCats.length > 0 && (
        <div style={{ width: "100%", maxWidth: 600 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink-2)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Top issues
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topCats.slice(0, 3).map((cat) => (
              <div
                key={cat.category}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "12px 16px",
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 14 }}>
                  {getCategoryLabel(cat.category).en}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    background: "var(--surface-2)",
                    borderRadius: "var(--r-sm)",
                    padding: "2px 8px",
                  }}
                >
                  {cat.cnt.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open data download */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 24px",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          Open data
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>
          Download all reports as a GeoJSON FeatureCollection. Coordinates are
          rounded to ~111 m precision. No personal information is included.
        </p>
        <a
          href="/api/reports.geojson"
          download="walkability-open-data.geojson"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fafaf9",
            borderRadius: "var(--r-full)",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Download open data (GeoJSON)
        </a>
      </div>

      {/* No-data fallback */}
      {!stats && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Statistics unavailable — please try again shortly.
        </p>
      )}
    </main>
  );
}
