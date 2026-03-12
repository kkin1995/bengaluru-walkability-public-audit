"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getAdminReports } from "../../lib/adminApi";
import type { AdminReport } from "../../lib/adminApi";
import { BENGALURU_CENTER } from "../../../lib/constants";

// ── Pure color function ────────────────────────────────────────────────────────

/** Maps report status to a pin fill color hex string. */
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
    return desc.slice(0, 100) + "\u2026";
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

// ── Category and status filter options ────────────────────────────────────────

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

// ── Main page component ────────────────────────────────────────────────────────

export default function ReportsMapPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
      setFetchError("Failed to load reports. Please try again.");
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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports Map</h1>
        <p className="text-gray-500 animate-pulse">Loading reports...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports Map</h1>
        <div role="alert" className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-700">{fetchError}</p>
        </div>
        <button
          onClick={loadReports}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports Map</h1>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div>
          <label htmlFor="category-filter" className="sr-only">
            Category
          </label>
          <select
            id="category-filter"
            name="category"
            aria-label="Category filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status-filter" className="sr-only">
            Status
          </label>
          <select
            id="status-filter"
            name="status"
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(categoryFilter || statusFilter) && (
          <button
            onClick={() => {
              setCategoryFilter("");
              setStatusFilter("");
            }}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* ── Empty state (zero total reports) ──────────────────────────── */}
      {reports.length === 0 && (
        <p className="text-gray-500 mb-4">No reports found.</p>
      )}

      {/* ── Empty state (filter yields zero) ──────────────────────────── */}
      {reports.length > 0 && filteredReports.length === 0 && (
        <p className="text-gray-500 mb-4">
          No reports match the current filters.
        </p>
      )}

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div data-testid="admin-reports-map" style={{ height: "600px", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {filteredReports.map((report) => (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
            >
              <Popup>
                <div>
                  <p>
                    <strong>Category:</strong> {report.category}
                  </p>
                  <p>
                    <strong>Status:</strong> {report.status}
                  </p>
                  <p>
                    <strong>Date:</strong> {formatDate(report.created_at)}
                  </p>
                  <p>
                    <strong>Description:</strong>{" "}
                    {truncateDescription(report.description)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
