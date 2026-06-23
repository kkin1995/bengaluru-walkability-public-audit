"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";
import type { PathOptions, Layer } from "leaflet";
import { BENGALURU_CENTER } from "../lib/constants";
import { getCategoryLabel, publicStatusLabel, publicStatusColor } from "../lib/translations";
// MAP-02: HeatmapLayer is safe here — ReportsMap is the ssr:false boundary.
// Do NOT import HeatmapLayer from any page or server component directly.
import HeatmapLayer from "./HeatmapLayer";

const BENGALURU_MAP_CENTER: [number, number] = [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng];

// FIX-04 (D-10): Call invalidateSize() after mount for iOS Safari tile blank fix.
// Must be a child of <MapContainer> so useMap() can access the map instance.
// ReportsMap is already an ssr:false dynamic import boundary (per map/page.tsx).
function MapSizeUpdater() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => { map.invalidateSize(); }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// MAP-01 (D-30): status-based public pin colors — 3-state mapping for citizens.
// open, acknowledged, assigned → red (var(--danger)) — attention needed
// in_progress                  → amber (var(--warn)) — in motion
// resolved, closed             → green (var(--accent)) — resolved
export const STATUS_COLORS: Record<string, string> = {
  open:         "var(--danger)",
  acknowledged: "var(--danger)",
  assigned:     "var(--danger)",
  in_progress:  "var(--warn)",
  resolved:     "var(--accent)",
  closed:       "var(--accent)",
};

// TRIAGE-04: WardBoundaryLayer renders stroke-only teal ward polygons.
// MUST be defined inside ReportsMap.tsx (inside the ssr:false boundary per CLAUDE.md Leaflet rule).
// GeoJSON component from react-leaflet is safe here — no window access outside Leaflet context.
// Risk 2: Leaflet SVG does not inherit CSS custom properties — resolve --accent at runtime.
function WardBoundaryLayer({ geojson }: { geojson: FeatureCollection }) {
  // Resolve the CSS var at render time so Leaflet SVG paths get a real color value.
  const accentColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "oklch(0.62 0.14 145)"
      : "oklch(0.62 0.14 145)";

  function wardStyle(): PathOptions {
    return {
      fill: false,
      color: accentColor,
      opacity: 0.5,
      weight: 1.5,
      lineJoin: "round",
    };
  }

  function onEachFeature(feature: Feature, layer: Layer) {
    const name = (feature.properties as Record<string, unknown>)?.ward_name as string | undefined;
    if (name) {
      // Bind tooltip so tapping/hovering a polygon shows the ward name (D-17).
      (layer as any).bindTooltip(name, { sticky: true, direction: "auto" });
    }
  }

  return (
    <GeoJSON
      // key ensures re-render if geojson reference changes (cache swap)
      key={String(geojson.features?.length ?? 0)}
      data={geojson}
      style={wardStyle}
      onEachFeature={onEachFeature}
      aria-hidden="true"
    />
  );
}


interface Report {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  description?: string;
  // WR-04: image_url is not included in the GeoJSON endpoint (privacy by design).
  // Made optional so the popup renders gracefully without it.
  image_url?: string;
  created_at: string;
  status: string;
  // Phase 03 popup additions (D-31): populated from GeoJSON endpoint via ward JOIN
  corporation?: string | null;
  ward_name?: string | null;
}

interface ReportsMapProps {
  apiUrl: string;
  categoryFilter?: string;
  // TRIAGE-03: client-side status filter (D-11). "all" or bucket key: "open" | "in_progress" | "resolved"
  statusFilter?: string;
  onReportsLoaded?: (reports: Report[]) => void;
  // TRIAGE-04: ward boundary overlay props
  showWardBoundaries?: boolean;
  wardBoundariesGeojson?: FeatureCollection | null;
}

export default function ReportsMap({
  apiUrl,
  categoryFilter,
  statusFilter,
  onReportsLoaded,
  showWardBoundaries,
  wardBoundariesGeojson,
}: ReportsMapProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WR-06: Use a ref to hold onReportsLoaded so fetchReports does not depend on
  // the callback prop directly. An inline callback passed by a caller would be a
  // new reference every render, causing fetchReports to be recreated, triggering
  // the useEffect, and producing an infinite API request loop.
  const onLoadedRef = useRef(onReportsLoaded);
  useEffect(() => { onLoadedRef.current = onReportsLoaded; }, [onReportsLoaded]);

  // Patch Leaflet's default icon once on mount — before any fetch so it is
  // always set regardless of how quickly the API responds.
  useEffect(() => {
    const L = require("leaflet");
    delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // WR-04: use the purpose-built GeoJSON endpoint instead of the paginated list.
      // GET /api/reports.geojson streams all reports with privacy-rounded coordinates
      // (~111 m precision) and no hard limit. The previous /api/reports?limit=200
      // silently dropped all reports beyond the 200th.
      const res = await fetch(`${apiUrl}/api/reports.geojson`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: {
        type: string;
        features: Array<{
          type: string;
          geometry: { type: string; coordinates: [number, number] };
          properties: {
            id: string;
            category: string;
            severity: string;
            status: string;
            ward_name?: string | null;
            corporation?: string | null;
            created_at: string;
            description?: string | null;
          };
        }>;
      } = await res.json();
      const items: Report[] = (data.features ?? []).map((f) => ({
        id: f.properties.id,
        // GeoJSON coordinates are [longitude, latitude] per RFC 7946
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        category: f.properties.category,
        severity: f.properties.severity,
        status: f.properties.status,
        ward_name: f.properties.ward_name,
        corporation: f.properties.corporation,
        created_at: f.properties.created_at,
        description: f.properties.description ?? undefined,
        // image_url is not included in the GeoJSON endpoint (privacy by design)
      }));
      setReports(items);
      onLoadedRef.current?.(items);
    } catch {
      setError("Couldn't load reports — tap to retry.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]); // onReportsLoaded intentionally omitted — see onLoadedRef above

  useEffect(() => {
    fetchReports();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchReports();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchReports]);

  // TRIAGE-03 (D-09): AND logic — both categoryFilter and statusFilter apply simultaneously.
  // statusMatch returns true when filter is unset/"all", or when the status belongs to the bucket.
  // Buckets are mutually exclusive: open → open only; in_progress → acknowledged|assigned|in_progress; resolved → resolved|closed.
  function reportStatusMatch(status: string): boolean {
    if (!statusFilter || statusFilter === "all") return true;
    if (statusFilter === "open")
      return status === "open";
    if (statusFilter === "in_progress")
      return status === "acknowledged" || status === "assigned" || status === "in_progress";
    if (statusFilter === "resolved")
      return status === "resolved" || status === "closed";
    return false;
  }

  // Always render MapContainer so Leaflet and tiles preload immediately.
  // Show a loading overlay on top while the API fetch is in-flight.
  // Show markers only after data has arrived.
  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={BENGALURU_MAP_CENTER}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
        zoomControl={false}
      >
        <MapSizeUpdater />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* MAP-02/D-02: toggleable density heatmap — toggled via layer control top-right (D-03) */}
        <HeatmapLayer reports={reports} />

        {/* TRIAGE-04: Ward boundary overlay — rendered only when showWardBoundaries is true and geojson is loaded */}
        {showWardBoundaries && wardBoundariesGeojson && (
          <WardBoundaryLayer geojson={wardBoundariesGeojson} />
        )}

        {!loading && !error && reports
          // TRIAGE-03 (D-09): AND logic — category filter AND status filter both applied
          .filter((r) => {
            const catOk = !categoryFilter || categoryFilter === "all" || r.category === categoryFilter;
            const statusOk = reportStatusMatch(r.status);
            return catOk && statusOk;
          })
          .map((report) => (
          <CircleMarker
            key={report.id}
            center={[report.latitude, report.longitude]}
            radius={8}
            fillColor={STATUS_COLORS[report.status] ?? "var(--danger)"}
            color="white"
            weight={2}
            fillOpacity={0.85}
          >
            <Popup>
              <div className="min-w-48 max-w-64">
                {/* WR-04: image_url not available from GeoJSON endpoint; only render if present */}
                {report.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={report.image_url}
                    alt="Report photo"
                    className="w-full h-32 object-cover rounded mb-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                {/* Category label + inline status chip (MAP-03 / D-31 per UI-SPEC §G) */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <p className="font-semibold text-sm" style={{ margin: 0 }}>
                    {getCategoryLabel(report.category).en}
                  </p>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: publicStatusColor(report.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 11 }}>{publicStatusLabel(report.status)}</span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 capitalize">
                  Severity: {report.severity}
                </p>
                {report.description && (
                  <p className="text-xs text-gray-700 mt-1">{report.description}</p>
                )}
                {/* GBA jurisdiction line (UI-SPEC §G): GBA tag + corporation + ward name */}
                {(report.corporation || report.ward_name) && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", background: "var(--surface-2)", padding: "4px 8px", borderRadius: 4 }}>GBA</span>
                    <span style={{ fontWeight: 600 }}>{report.corporation ?? "—"}</span>
                    <span>·</span>
                    <span>{report.ward_name ?? "—"}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(report.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {/* Read More → link (UI-SPEC §G / D-27, D-28): links to public report detail page */}
                <a
                  href={`/reports/${report.id}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, color: "var(--accent-ink)", fontWeight: 600, fontSize: 12 }}
                >
                  Read More →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Loading overlay — sits above the map while fetch is in-flight */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-white/90 rounded-xl px-6 py-4 shadow text-center mx-4">
            <p className="text-gray-500 text-sm">Loading reports…</p>
          </div>
        </div>
      )}

      {/* Error overlay with retry */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-[1000]">
          <div className="bg-white/95 rounded-xl px-6 py-4 shadow text-center mx-4">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button
              onClick={fetchReports}
              className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 rounded-xl px-6 py-4 shadow text-center mx-4">
            <p className="text-gray-600 text-sm font-medium">
              No reports yet. Be the first to report an issue.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
