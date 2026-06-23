"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  getWardAnalytics,
  getCorporationAnalytics,
  getTrendData,
  downloadCsvExport,
  downloadGeoJsonExport,
  type WardAnalytics,
  type CorporationAnalytics,
  type TrendDataPoint,
} from "../lib/adminApi";
import { Card } from "../components/Card";
import { Btn } from "../components/Btn";
import { SectionLabel } from "../components/SectionLabel";
import KpiCards from "../components/KpiCards";
import WardTable from "../components/WardTable";
import { getCategoryLabel } from "@/app/lib/translations";

const TrendChart = dynamic(() => import("../components/TrendChart"), { ssr: false });
const ChoroplethMap = dynamic(() => import("./ChoroplethMap"), { ssr: false });

export default function AnalyticsPage() {
  const [wardData, setWardData] = useState<WardAnalytics[]>([]);
  const [corpData, setCorpData] = useState<CorporationAnalytics[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [wards, corps, trend] = await Promise.all([
        getWardAnalytics(),
        getCorporationAnalytics(),
        getTrendData(),
      ]);
      setWardData(wards);
      setCorpData(corps);
      setTrendData(trend);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  async function handleCsvDownload() {
    try {
      const blob = await downloadCsvExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "walkability-reports.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // CR-02: defer revocation so the browser has time to initiate the download
      // before the Blob URL is invalidated. Synchronous revocation races the
      // browser's download initiation and silently fails on some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      /* non-critical */
    }
  }

  async function handleGeoJsonDownload() {
    try {
      const blob = await downloadGeoJsonExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "walkability-reports.geojson";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // CR-02: defer revocation so the browser has time to initiate the download.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      /* non-critical */
    }
  }

  return (
    <div
      className="admin-safe-bottom"
      style={{
        paddingTop: "24px",
        paddingLeft: "32px",
        paddingRight: "32px",
        maxWidth: 1200,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: 0,
          }}
        >
          Analytics
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={handleCsvDownload} disabled={isLoading}>
            Export CSV
          </Btn>
          <Btn variant="ghost" size="sm" onClick={handleGeoJsonDownload} disabled={isLoading}>
            Export GeoJSON
          </Btn>
        </div>
      </div>

      {isError && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Failed to load analytics data</SectionLabel>
          <Btn variant="ghost" size="sm" onClick={fetchAnalytics}>
            Retry
          </Btn>
        </div>
      )}

      {/* KPI cards — full width */}
      <KpiCards wardData={wardData} corpData={corpData} isLoading={isLoading} />

      {/* Trend chart — full width */}
      <Card style={{ marginBottom: 24 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Reports per Week (12 weeks)</SectionLabel>
        {isLoading ? (
          <div
            style={{
              height: 280,
              background: "var(--surface-2)",
              borderRadius: "var(--r-sm)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <TrendChart data={trendData} legendFormatter={(v) => getCategoryLabel(v).en} />
        )}
      </Card>

      {/* Ward table + choropleth — side by side on desktop, stacked on mobile (D-06, MOB-05) */}
      <div className="analytics-ward-grid">
        <div>
          <SectionLabel style={{ marginBottom: 8 }}>
            Top Wards by Unresolved Reports
            {selectedWard && ` — ${selectedWard}`}
          </SectionLabel>
          <WardTable data={wardData} selectedWard={selectedWard} />
          {selectedWard && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWard(null)}
              style={{ marginTop: 8 }}
            >
              Clear filter
            </Btn>
          )}
        </div>
        {/* MOB-05/06: explicit height on wrapper prevents choropleth from collapsing
            on mobile. Height matches ChoroplethMap's internal MapContainer (400px).
            Width: 100% ensures no horizontal scroll on narrow viewports. */}
        <div style={{ width: "100%", minWidth: 0 }}>
          <SectionLabel style={{ marginBottom: 8 }}>
            Ward Map — click to filter
          </SectionLabel>
          <div style={{ height: 400, width: "100%" }}>
            <ChoroplethMap onWardClick={setSelectedWard} />
          </div>
        </div>
      </div>
    </div>
  );
}
