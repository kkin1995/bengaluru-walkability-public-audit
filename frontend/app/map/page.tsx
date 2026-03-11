import nextDynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { API_BASE_URL } from "@/app/lib/config";

export const dynamic = 'force-dynamic';

// Disable SSR — Leaflet requires window
const ReportsMap = nextDynamic(() => import("../components/ReportsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return (
    <main className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
        <Link
          href="/"
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">All Reports</h1>
          <p className="text-xs text-gray-500">
            Tap a marker to see photo and details
          </p>
        </div>
        <Link
          href="/report"
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
        >
          <Camera className="w-4 h-4" />
          Report
        </Link>
      </header>

      {/* Legend */}
      <div className="flex gap-3 px-4 py-2 overflow-x-auto flex-shrink-0 border-b border-gray-50 bg-gray-50">
        {[
          { label: "No footpath", color: "#ef4444" },
          { label: "Broken", color: "#f97316" },
          { label: "Blocked", color: "#eab308" },
          { label: "Crossing", color: "#8b5cf6" },
          { label: "Lighting", color: "#6b7280" },
          { label: "Other", color: "#3b82f6" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-600 whitespace-nowrap">{label}</span>
          </div>
        ))}
      </div>

      {/* Map — fills remaining space */}
      <div className="flex-1">
        <ReportsMap apiUrl={API_BASE_URL} />
      </div>
    </main>
  );
}
