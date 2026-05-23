"use client";

import { Card } from "./Card";
import { Pill } from "./Pill";
import { Btn } from "./Btn";
import { SectionLabel } from "./SectionLabel";

interface StatsData {
  total_reports: number;
  by_status: {
    submitted: number;
    under_review: number;
    resolved: number;
  };
}

interface StatsCardsProps {
  data?: StatsData | null;
  loading?: boolean;
  // Props used by dashboard page (stats / isLoading / isError / onRetry shapes)
  stats?: {
    total: number;
    submitted: number;
    under_review: number;
    resolved: number;
  } | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
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

export default function StatsCards({
  data,
  loading,
  stats,
  isLoading,
  isError,
  onRetry,
}: StatsCardsProps) {
  // Support both prop shapes
  const isLoadingState = loading === true || isLoading === true;

  if (isLoadingState) {
    return (
      <div
        data-testid="stats-cards-loading"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="stats-cards-error"
        style={{ textAlign: "center", padding: "32px 0" }}
      >
        <Pill tone="danger" style={{ marginBottom: 16 }}>
          Failed to load statistics.
        </Pill>
        {onRetry && (
          <div style={{ marginTop: 12 }}>
            <Btn
              data-testid="stats-retry-button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
            >
              Retry
            </Btn>
          </div>
        )}
      </div>
    );
  }

  // Resolve values from whichever prop shape was used
  let total: number;
  let submitted: number;
  let underReview: number;
  let resolved: number;

  if (stats !== undefined && stats !== null) {
    total = stats.total;
    submitted = stats.submitted;
    underReview = stats.under_review;
    resolved = stats.resolved;
  } else if (data !== undefined && data !== null) {
    total = data.total_reports;
    submitted = data.by_status.submitted;
    underReview = data.by_status.under_review;
    resolved = data.by_status.resolved;
  } else {
    // No data yet — render with zeros
    total = 0;
    submitted = 0;
    underReview = 0;
    resolved = 0;
  }

  const countStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: 28,
    fontWeight: 700,
    color: "var(--ink)",
    lineHeight: 1.1,
    marginTop: 6,
  };

  return (
    <div
      data-testid="stats-cards"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
      }}
    >
      <Card>
        <SectionLabel>Total Reports</SectionLabel>
        <p data-testid="stat-total" style={countStyle}>
          {total}
        </p>
      </Card>
      <Card>
        <SectionLabel>Submitted</SectionLabel>
        <p data-testid="stat-submitted" style={countStyle}>
          {submitted}
        </p>
      </Card>
      <Card>
        <SectionLabel>Under Review</SectionLabel>
        <p data-testid="stat-under-review" style={countStyle}>
          {underReview}
        </p>
      </Card>
      <Card>
        <SectionLabel>Resolved</SectionLabel>
        <p data-testid="stat-resolved" style={countStyle}>
          {resolved}
        </p>
      </Card>
    </div>
  );
}
