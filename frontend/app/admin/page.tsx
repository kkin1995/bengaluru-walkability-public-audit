"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getStats, getAdminReports, getIntakeStats, type AdminStats, type AdminReport, type IntakeDayCount } from "./lib/adminApi";
import { useOnlineStatus } from "./lib/useOnlineStatus";
import { getCategoryLabel } from "@/app/lib/translations";
import StatsCards from "./components/StatsCards";
import { Card } from "./components/Card";
import { Btn } from "./components/Btn";
import { Pill } from "./components/Pill";
import { SectionLabel } from "./components/SectionLabel";
import { SeverityIndicator } from "./components/SeverityIndicator";
import { Sparkbars } from "./components/Sparkbars";
import { Icon } from "./components/Icon";
import { ThemeToggleButton } from "./components/ThemeToggleButton";

function formatActivityTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusActionLabel(status: string): string {
  if (status === "resolved" || status === "closed") return "Resolved";
  if (status === "in_progress" || status === "assigned" || status === "acknowledged") return "In progress";
  return "New"; // open + unknown
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [recentReports, setRecentReports] = useState<AdminReport[]>([]);
  const isOnline = useOnlineStatus();
  // Phase 03.2 (D-01): Active period state for the intake sparkbars chart
  const [activePeriod, setActivePeriod] = useState<"7D" | "14D" | "30D">("14D");
  // BUG-03.2-A: Real intake data — replaces the former hardcoded stub (removed)
  const [intakeData, setIntakeData] = useState<number[]>([]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getStats();
      setStats(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    getAdminReports({ limit: 5, page: 1 })
      .then((res) => setRecentReports(res.data ?? []))
      .catch(() => { /* non-critical — activity feed stays empty on error */ });
  }, [fetchStats]);

  // Responsive switching: desktop layout at ≥1024px
  // Guard: window.matchMedia may not be available in test environments
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // BUG-03.2-A: Fetch real per-day intake counts whenever the active period changes.
  // Zero-fills sparse days (days with no submissions) oldest→newest.
  // On fetch error, falls back to an all-zero array of the correct length (no crash).
  // IMPORTANT: Do NOT call setActivePeriod inside this effect — infinite loop risk.
  useEffect(() => {
    const dayCount = activePeriod === "7D" ? 7 : activePeriod === "30D" ? 30 : 14;

    getIntakeStats(dayCount)
      .then((rows: IntakeDayCount[]) => {
        // Build a dense number[] of length dayCount, ordered oldest→newest.
        // Days absent from the API response are zero-filled.
        const rowMap: Record<string, number> = {};
        for (const r of rows) {
          rowMap[r.day] = r.count;
        }

        const dense: number[] = [];
        const now = new Date();
        for (let i = dayCount - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setUTCDate(d.getUTCDate() - i);
          const key = d.toISOString().slice(0, 10);
          dense.push(rowMap[key] ?? 0);
        }
        setIntakeData(dense);
      })
      .catch(() => {
        // Non-critical: show flat-zero bars on error rather than crashing
        const dayCount2 = activePeriod === "7D" ? 7 : activePeriod === "30D" ? 30 : 14;
        setIntakeData(Array(dayCount2).fill(0) as number[]);
      });
  }, [activePeriod]);

  // Derive the stats shape expected by StatsCards
  // Phase 03 (D-03): by_status now uses 6-value lifecycle shape
  const statsForCards = stats
    ? {
        total: stats.total_reports,
        // Map new 6-value shape to legacy StatsCards expectations
        submitted: stats.by_status.open,
        under_review: stats.by_status.acknowledged + stats.by_status.assigned + stats.by_status.in_progress,
        resolved: stats.by_status.resolved + stats.by_status.closed,
      }
    : null;

  // Derived counts
  const openReports = statsForCards
    ? (statsForCards.submitted + statsForCards.under_review)
    : 0;

  // Severity composition (stub percentages — derived from by_severity when available)
  const highCount = stats?.by_severity?.high ?? 0;
  const mediumCount = stats?.by_severity?.medium ?? 0;
  const lowCount = stats?.by_severity?.low ?? 0;
  const totalSeverity = highCount + mediumCount + lowCount || 1;
  const highPct = Math.round((highCount / totalSeverity) * 100);
  const mediumPct = Math.round((mediumCount / totalSeverity) * 100);
  const lowPct = 100 - highPct - mediumPct;

  // BUG-03.2-A: Derive the Sparkbars window size from the active period.
  // intakeData is populated by the [activePeriod] useEffect above.
  // Show flat-zero bars during first load (before the first fetch resolves) rather
  // than a blank chart — RESEARCH.md Pitfall 5.
  const intakeDayCount = activePeriod === "7D" ? 7 : activePeriod === "30D" ? 30 : 14;
  const sparkbarsValues: number[] =
    intakeData.length > 0 ? intakeData : (Array(intakeDayCount).fill(0) as number[]);

  // ─── Offline banner ─────────────────────────────────────────────────────────
  const offlineBanner = !isOnline ? (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--warn-bg)",
        color: "var(--warn-ink)",
        border: "1px solid var(--warn-border)",
        padding: "10px 14px",
        borderRadius: "var(--r-md)",
        marginBottom: 20,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Icon name="alert" size={16} aria-hidden={true} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          You're offline right now
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online.
        </div>
      </div>
    </div>
  ) : null;

  // ─── Severity composition rows ──────────────────────────────────────────────
  const severityComposition = (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Severity Distribution</SectionLabel>
      <ul
        role="list"
        aria-label="Open reports by severity"
        style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}
      >
        {(
          [
            { level: "high" as const, count: highCount, pct: highPct },
            { level: "medium" as const, count: mediumCount, pct: mediumPct },
            { level: "low" as const, count: lowCount, pct: lowPct },
          ] as const
        ).map(({ level, count, pct }) => (
          <li
            role="listitem"
            key={level}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <SeverityIndicator severity={level} style={{ minWidth: 70 }} />
            <div
              style={{
                flex: 1,
                height: 4,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background:
                    level === "high"
                      ? "var(--sev-high)"
                      : level === "medium"
                      ? "var(--sev-medium)"
                      : "var(--sev-low)",
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-2)",
                minWidth: 40,
                textAlign: "right",
              }}
            >
              {count} / {pct}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  // ─── Activity feed ──────────────────────────────────────────────────────────
  const activityFeed = (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>Recent Activity</SectionLabel>
      {recentReports.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No recent activity.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {recentReports.map((report) => {
            const action = statusActionLabel(report.status);
            return (
              <li
                key={report.id}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--muted)",
                    minWidth: 36,
                  }}
                >
                  {formatActivityTime(report.created_at)}
                </span>
                <Pill
                  tone={
                    action === "Resolved"
                      ? "accent"
                      : action === "Under review"
                      ? "info"
                      : "neutral"
                  }
                  size="sm"
                >
                  {action}
                </Pill>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  {getCategoryLabel(report.category).en}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  // ─── Sync state bar (mobile) ─────────────────────────────────────────────────
  const syncBar = (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 16,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isOnline ? "#22c55e" : "var(--muted)",
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "0.04em",
        }}
      >
        {isOnline ? "Synced just now" : "Offline"}
      </span>
    </div>
  );

  // ─── Mobile layout ──────────────────────────────────────────────────────────
  const mobileLayout = (
    <div style={{ display: isDesktop ? "none" : "block" }}>
      {syncBar}

      {/* Hero open-reports card */}
      <Card
        style={{
          border: "1px solid var(--accent-border)",
          background: "var(--accent-bg)",
          marginBottom: 16,
        }}
      >
        <SectionLabel style={{ color: "var(--accent-ink)", marginBottom: 8 }}>Open Reports</SectionLabel>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-hero-mobile)",
            fontWeight: 700,
            color: "var(--accent-ink)",
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          {openReports}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--accent-ink)",
            opacity: 0.7,
            marginBottom: 14,
          }}
        >
          {stats ? `+${stats.today_count} today` : "—"}
        </div>
        <Btn variant="accent" size="lg" style={{ width: "100%" }} onClick={() => router.push("/admin/reports")}>
          Start reviewing
        </Btn>
      </Card>

      {/* 2×2 metric grid */}
      <div style={{ marginBottom: 16 }}>
        <StatsCards
          stats={statsForCards}
          isLoading={isLoading}
          isError={isError}
          onRetry={fetchStats}
        />
      </div>

      {/* Severity composition */}
      <div style={{ marginBottom: 16 }}>{severityComposition}</div>

      {/* Activity feed */}
      {activityFeed}
    </div>
  );

  // ─── Desktop layout ─────────────────────────────────────────────────────────
  const desktopLayout = (
    <div style={{ display: isDesktop ? "block" : "none" }}>
      {/* Hero metrics row — 4-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Inverted ink hero card */}
        <Card
          style={{
            background: "var(--ink)",
            border: "1px solid var(--ink)",
            color: "var(--bg)",
          }}
        >
          <SectionLabel style={{ color: "var(--bg)", opacity: 0.6 }}>Open Reports</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-hero-desktop)",
              fontWeight: 700,
              color: "var(--bg)",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {openReports}
          </div>
        </Card>

        {/* Three metric cards */}
        <Card>
          <SectionLabel>Submitted</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {statsForCards?.submitted ?? 0}
          </div>
        </Card>
        <Card>
          <SectionLabel>Under Review</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {statsForCards?.under_review ?? 0}
          </div>
        </Card>
        <Card>
          <SectionLabel>Resolved</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {statsForCards?.resolved ?? 0}
          </div>
        </Card>
      </div>

      {/* Intake sparkbars with period filter — Phase 03.2 (D-01, D-02) */}
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <SectionLabel>
            {activePeriod === "7D" ? "Intake · 7_Day" : activePeriod === "30D" ? "Intake · 30_Day" : "Intake · 14_Day"}
          </SectionLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {(["7D", "14D", "30D"] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setActivePeriod(label)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                }}
                aria-pressed={label === activePeriod}
              >
                <Pill
                  tone={label === activePeriod ? "accent" : "outline"}
                  size="sm"
                >
                  {label}
                </Pill>
              </button>
            ))}
          </div>
        </div>
        <Sparkbars
          values={sparkbarsValues}
          color="var(--ink-2)"
          height={48}
          width={600}
        />
      </Card>

      {/* Two-column bottom: severity + activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {severityComposition}
        {activityFeed}
      </div>
    </div>
  );

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Dashboard
        </h1>
        <ThemeToggleButton />
      </div>

      {offlineBanner}

      {mobileLayout}
      {desktopLayout}
    </div>
  );
}
