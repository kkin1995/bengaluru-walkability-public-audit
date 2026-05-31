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
      URL.revokeObjectURL(url);
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
      URL.revokeObjectURL(url);
    } catch {
      /* non-critical */
    }
  }

  return (
    <div
      style={{
        padding: "24px 32px",
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
          <TrendChart data={trendData} selectedWard={selectedWard} />
        )}
      </Card>

      {/* Ward table + choropleth — side by side (D-06) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
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
        <div>
          <SectionLabel style={{ marginBottom: 8 }}>
            Ward Map — click to filter
          </SectionLabel>
          <ChoroplethMap onWardClick={setSelectedWard} />
        </div>
      </div>
    </div>
  );
}
