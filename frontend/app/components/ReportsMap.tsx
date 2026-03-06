"use client";

import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { BENGALURU_CENTER } from "../lib/constants";

const BENGALURU_MAP_CENTER: [number, number] = [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng];

const CATEGORY_COLORS: Record<string, string> = {
  no_footpath: "#ef4444",
  broken_footpath: "#f97316",
  blocked_footpath: "#eab308",
  unsafe_crossing: "#8b5cf6",
  poor_lighting: "#6b7280",
  other: "#3b82f6",
};

const CATEGORY_LABELS: Record<string, string> = {
  no_footpath: "No Footpath",
  broken_footpath: "Damaged Footpath",
  blocked_footpath: "Blocked Footpath",
  unsafe_crossing: "Unsafe Crossing",
  poor_lighting: "Poor Lighting",
  other: "Other Issue",
};

interface Report {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  description?: string;
  image_url: string;
  created_at: string;
  status: string;
}

interface ReportsMapProps {
  apiUrl: string;
}

export default function ReportsMap({ apiUrl }: ReportsMapProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fix Leaflet default icon in Next.js
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

      const res = await fetch(`${apiUrl}/api/reports?limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(data.items ?? []);
    } catch {
      setError("Couldn't load reports — tap to retry.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading reports…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-500">
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchReports}
          className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
    <MapContainer
      center={BENGALURU_MAP_CENTER}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {reports.map((report) => (
        <CircleMarker
          key={report.id}
          center={[report.latitude, report.longitude]}
          radius={8}
          fillColor={CATEGORY_COLORS[report.category] ?? "#3b82f6"}
          color="white"
          weight={2}
          fillOpacity={0.85}
        >
          <Popup>
            <div className="min-w-48 max-w-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={report.image_url}
                alt="Report photo"
                className="w-full h-32 object-cover rounded mb-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="font-semibold text-sm">
                {CATEGORY_LABELS[report.category] ?? report.category}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                Severity: {report.severity}
              </p>
              {report.description && (
                <p className="text-xs text-gray-700 mt-1">{report.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(report.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
    {reports.length === 0 && (
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
