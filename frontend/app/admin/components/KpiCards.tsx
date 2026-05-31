"use client";

import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import type { WardAnalytics, CorporationAnalytics } from "../lib/adminApi";

interface KpiCardsProps {
  wardData?: WardAnalytics[];
  corpData?: CorporationAnalytics[];
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div
      data-testid="skeleton"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 16,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <div
        style={{
          height: 10,
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          width: "50%",
          marginBottom: 12,
        }}
      />
      <div
        style={{
          height: 28,
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          width: "33%",
        }}
      />
    </div>
  );
}

const countStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 28,
  fontWeight: 700,
  color: "var(--ink)",
  lineHeight: 1.1,
  marginTop: 6,
} as const;

export default function KpiCards({ wardData = [], corpData = [], isLoading }: KpiCardsProps) {
  if (isLoading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const topWard = wardData[0]?.ward_name ?? "—";
  const topUnresolved = wardData[0]?.unresolved_count ?? 0;
  const totalReports = wardData.reduce((s, w) => s + w.total_count, 0);

  const overallResolved = corpData.reduce((s, c) => s + c.resolved_count, 0);
  const overallTotal = corpData.reduce((s, c) => s + c.total_reports, 0);
  const resolutionRate =
    overallTotal > 0 ? Math.round((overallResolved / overallTotal) * 100) : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Card>
        <SectionLabel>Top Unresolved Ward</SectionLabel>
        <p style={{ ...countStyle, fontSize: 16, wordBreak: "break-word" }}>{topWard}</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {topUnresolved} unresolved
        </p>
      </Card>
      <Card>
        <SectionLabel>Resolution Rate</SectionLabel>
        <p style={countStyle}>{resolutionRate}%</p>
      </Card>
      <Card>
        <SectionLabel>Total Reports</SectionLabel>
        <p style={countStyle}>{totalReports}</p>
      </Card>
    </div>
  );
}
