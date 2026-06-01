"use client";

import React, { useState, useEffect, useCallback } from "react";
import StatusBadge from "./StatusBadge";
import { SeverityIndicator } from "./SeverityIndicator";
import { PhotoTile } from "./PhotoTile";
import { Pill } from "./Pill";
import { Btn } from "./Btn";
import { Card } from "./Card";
import { Input } from "./Input";
import { getDuplicatesForReport, type AdminReport } from "../lib/adminApi";
import { getCategoryLabel } from "@/app/lib/translations";
import { API_BASE_URL } from "@/app/lib/config";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Report {
  id: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  image_path?: string;
  image_url?: string;
  ward_name?: string | null;
  description?: string | null;
  latitude?: number;
  longitude?: number;
  location_source?: string;
  // ABUSE-06: Deduplication signals
  duplicate_count?: number;
  duplicate_of_id?: string | null;
  duplicate_confidence?: string | null;
}

interface ReportsTableProps {
  reports: Report[];
  role: "admin" | "reviewer";
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  onCategoryChange?: (value: string) => void;
  onStatusFilter?: (value: string) => void;
  onUpdateStatus?: (id: string) => void;
  // Pagination props (optional)
  totalCount?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

type ViewMode = "card-stream" | "compact-rows" | "table";

// Number of columns in the main table — used for colSpan on expanded rows
// Phase 03: Updated from 8 to 9 to include CORP column (UI-SPEC §F)
const COLUMN_COUNT = 9;

// Phase 03: Card-view status dot colour lookup — uses current 6-value enum tokens (D-37)
const STATUS_DOT_COLORS: Record<string, string> = {
  open:         "var(--status-open)",
  acknowledged: "var(--status-acknowledged)",
  assigned:     "var(--status-assigned)",
  in_progress:  "var(--status-in-progress)",
  resolved:     "var(--status-resolved)",
  closed:       "var(--status-closed)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  if (hours < 24) return `${hours}H AGO`;
  if (days === 1) return "YESTERDAY";
  if (days < 7) return `${days}D AGO`;
  return new Date(isoString).toLocaleDateString().toUpperCase();
}

function getDayLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - d.getTime();
  if (diff === 0) return "TODAY";
  if (diff === 86400000) return "YESTERDAY";
  const month = date.toLocaleString("en", { month: "short" }).toUpperCase();
  return `${month} ${date.getDate()}`;
}

function groupByDay(reports: Report[]): { label: string; items: Report[] }[] {
  const groups: { label: string; items: Report[] }[] = [];
  const seen: Record<string, number> = {};
  for (const r of reports) {
    const label = getDayLabel(r.created_at);
    if (seen[label] === undefined) {
      seen[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[seen[label]].items.push(r);
  }
  return groups;
}

function getSevLevel(severity: string): "high" | "medium" | "low" {
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return "low";
}

// ─── Duplicate sub-table ──────────────────────────────────────────────────────

interface DupeSubTableProps {
  reportId: string;
  dupCount: number;
  expandedRows: Record<string, boolean>;
  duplicateRows: Record<string, AdminReport[]>;
  onToggle: (id: string) => void;
}

function DupeExpandButton({ reportId, dupCount, expandedRows, onToggle }: Omit<DupeSubTableProps, "duplicateRows">) {
  return (
    <>
      <span
        data-testid="duplicate-count-badge"
        title="Number of duplicate reports at this location"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--warn-ink)",
          fontWeight: 600,
        }}
      >
        {dupCount}×
      </span>
      <button
        data-testid="expand-duplicates-btn"
        onClick={(e) => { e.stopPropagation(); onToggle(reportId); }}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--warn-ink)",
          textDecoration: "underline",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
        aria-expanded={expandedRows[reportId] ?? false}
        aria-label={`Show ${dupCount} duplicate reports`}
      >
        {expandedRows[reportId]
          ? "Hide duplicates"
          : `+${dupCount} duplicates`}
      </button>
    </>
  );
}

function DupeSubTable({ duplicates }: { duplicates: AdminReport[] | undefined }) {
  if (duplicates === undefined) {
    return <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Loading…</p>;
  }
  if (duplicates.length === 0) {
    return <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>No duplicates loaded yet.</p>;
  }
  return (
    <table data-testid="dupe-subtable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid var(--warn-border)" }}>
          {["Ward", "Date", "Category", "Status", "Severity"].map((h) => (
            <th key={h} style={{ padding: "4px 8px 4px 0", fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {duplicates.map((dupe) => (
          <tr
            key={dupe.id}
            style={{ borderBottom: "1px solid var(--warn-border)", cursor: "pointer" }}
            onClick={() => window.location.assign(`/admin/reports/${dupe.id}`)}
          >
            <td style={{ padding: "6px 8px 6px 0", color: "var(--ink-2)" }}>
              <a href={`/admin/reports/${dupe.id}`} className="sr-only">View report</a>
              {dupe.ward_name ?? "—"}
            </td>
            <td style={{ padding: "6px 8px 6px 0", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {new Date(dupe.created_at).toLocaleDateString()}
            </td>
            <td style={{ padding: "6px 8px 6px 0", color: "var(--ink-2)" }}>
              {getCategoryLabel(dupe.category).en}
            </td>
            <td style={{ padding: "6px 8px 6px 0" }}>
              <StatusBadge status={dupe.status} />
            </td>
            <td style={{ padding: "6px 0", color: "var(--ink-2)" }}>
              {dupe.severity}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Card Stream Row ──────────────────────────────────────────────────────────

interface CardRowProps {
  report: Report;
  role: "admin" | "reviewer";
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus?: (id: string) => void;
  expandedRows: Record<string, boolean>;
  duplicateRows: Record<string, AdminReport[]>;
  onToggleExpand: (id: string) => void;
}

function CardStreamRow({ report, role, onStatusChange, onDelete, onUpdateStatus, expandedRows, duplicateRows, onToggleExpand }: CardRowProps) {
  const categoryLabel = getCategoryLabel(report.category).en;
  const dupCount = report.duplicate_count ?? 0;
  const sevValue = getSevLevel(report.severity);

  return (
    <div>
      <Card padded={false} style={{ marginBottom: 8, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px 6px",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href={`/admin/reports/${report.id}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink-2)",
                letterSpacing: "-0.01em",
                textDecoration: "underline",
                textDecorationColor: "var(--muted)",
              }}
            >
              WLK-{report.id.slice(0, 5).toUpperCase()}
            </a>
            {/* ABUSE-06: Duplicate label for reports that are duplicates */}
            {report.duplicate_of_id && (
              <span
                data-testid="duplicate-label"
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", fontStyle: "italic" }}
              >
                Duplicate
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: STATUS_DOT_COLORS[report.status] ?? "var(--status-open)",
                flexShrink: 0,
              }}
            />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              color: "var(--muted)",
              letterSpacing: "0.04em",
            }}>
              {getRelativeTime(report.created_at)}
            </span>
          </div>
        </div>

        {/* Body row */}
        <div style={{
          display: "flex",
          gap: 10,
          padding: "0 12px 8px",
          alignItems: "flex-start",
        }}>
          <PhotoTile
            size={64}
            radius="var(--r-xs)"
            src={report.image_path ? `${API_BASE_URL}/uploads/${report.image_path}` : undefined}
            alt={`Citizen-submitted photo of ${categoryLabel} at ${report.ward_name ?? "unknown ward"}`}
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
              marginBottom: 3,
              lineHeight: 1.3,
            }}>
              {categoryLabel}
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              color: "var(--muted)",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              {/* "Ward" label (accessible column label for card layout — required by WARD-01) */}
              <span style={{ color: "var(--muted-2)", fontWeight: 400 }}>Ward</span>
              {/* Ward value in its own span so tests can getByText(ward_name) */}
              <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{report.ward_name ?? "—"}</span>
              {report.location_source && <span style={{ color: "var(--muted)" }}>· {report.location_source.toUpperCase()}</span>}
            </div>
            {report.description && (
              <div style={{
                fontSize: 12,
                color: "var(--ink-2)",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
              }}>
                {report.description}
              </div>
            )}
          </div>
        </div>

        {/* Footer row — dashed border-top per UI-SPEC */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px 8px",
          borderTop: "1px dashed var(--border)",
          gap: 8,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeverityIndicator severity={sevValue} />
            <StatusBadge status={report.status} />
            {/* ABUSE-06: Duplicate count badge + expand for original reports */}
            {dupCount > 0 && (
              <DupeExpandButton
                reportId={report.id}
                dupCount={dupCount}
                expandedRows={expandedRows}
                onToggle={onToggleExpand}
              />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Btn
              variant="ghost"
              size="xs"
              onClick={() => (onUpdateStatus ?? onStatusChange)(report.id)}
              aria-label={`Change status for report ${report.id}`}
            >
              Status
            </Btn>
            {role === "admin" && (
              <Btn
                variant="danger-soft"
                size="xs"
                onClick={() => onDelete(report.id)}
                aria-label={`Delete report ${report.id}`}
                data-testid="delete-button"
              >
                Delete
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Duplicate sub-table when expanded */}
      {expandedRows[report.id] && (
        <div
          data-testid="duplicate-group"
          style={{
            background: "var(--warn-bg)",
            border: "1px dashed var(--warn-border)",
            padding: "8px 12px",
            marginBottom: 8,
          }}
        >
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            Duplicate reports linked to this location:
          </p>
          <DupeSubTable duplicates={duplicateRows[report.id]} />
        </div>
      )}
    </div>
  );
}

// ─── Compact Row ──────────────────────────────────────────────────────────────

function CompactRow({ report, role, onStatusChange, onDelete, onUpdateStatus, expandedRows, duplicateRows, onToggleExpand }: CardRowProps) {
  const categoryLabel = getCategoryLabel(report.category).en;
  const dupCount = report.duplicate_count ?? 0;
  const sevValue = getSevLevel(report.severity);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "8px 0",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
        }}
        onClick={() => window.location.assign(`/admin/reports/${report.id}`)}
      >
        {/* sr-only anchor for accessibility — same pattern as DupeSubTable */}
        <a href={`/admin/reports/${report.id}`} className="sr-only">
          View report {report.id.slice(0, 5).toUpperCase()}
        </a>
        <PhotoTile
          size={44}
          radius="var(--r-xs)"
          src={report.image_path ? `${API_BASE_URL}/uploads/${report.image_path}` : undefined}
          alt={`Photo of ${categoryLabel}`}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            color: "var(--ink)",
            marginBottom: 3,
          }}>
            {categoryLabel}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            display: "flex",
            gap: 6,
            alignItems: "center",
            overflow: "hidden",
          }}>
            <span style={{ fontWeight: 600, color: "var(--ink-2)", flexShrink: 0 }}>
              WLK-{report.id.slice(0, 5).toUpperCase()}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>{report.ward_name ?? "—"}</span>
            <span style={{ flexShrink: 0 }}>{getRelativeTime(report.created_at)}</span>
            {/* ABUSE-06: Duplicate label */}
            {report.duplicate_of_id && (
              <span
                data-testid="duplicate-label"
                style={{ fontStyle: "italic" }}
              >
                Duplicate
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {dupCount > 0 && (
            <DupeExpandButton
              reportId={report.id}
              dupCount={dupCount}
              expandedRows={expandedRows}
              onToggle={onToggleExpand}
            />
          )}
          <SeverityIndicator severity={sevValue} />
          <StatusBadge status={report.status} monoLabel />
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <Btn
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); (onUpdateStatus ?? onStatusChange)(report.id); }}
            aria-label={`Change status for report ${report.id}`}
          >
            Status
          </Btn>
          {role === "admin" && (
            <Btn
              variant="danger-soft"
              size="xs"
              onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
              aria-label={`Delete report ${report.id}`}
              data-testid="delete-button"
            >
              Delete
            </Btn>
          )}
        </div>
      </div>

      {/* Duplicate sub-table when expanded */}
      {expandedRows[report.id] && (
        <div
          data-testid="duplicate-group"
          style={{
            background: "var(--warn-bg)",
            border: "1px dashed var(--warn-border)",
            padding: "8px 12px",
          }}
        >
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            marginBottom: 6,
          }}>
            Duplicate reports linked to this location:
          </p>
          <DupeSubTable duplicates={duplicateRows[report.id]} />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsTable({
  reports,
  role,
  onStatusChange,
  onDelete,
  isLoading,
  onUpdateStatus,
  totalCount,
  page = 1,
  totalPages = 1,
  onPageChange,
}: ReportsTableProps) {
  // View mode state — default based on viewport (safe for SSR/test environments)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      return "table";
    }
    // Default to card-stream on mobile and in test environments
    return "card-stream";
  });

  // Filter state
  const [activeFilters, setActiveFilters] = useState<string[]>(["all"]);
  const [searchQuery, setSearchQuery] = useState("");

  // Expandable row state — keyed by report ID (PRESERVED from original)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [duplicateRows, setDuplicateRows] = useState<Record<string, AdminReport[]>>({});

  // Sync view mode on resize
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      setViewMode(e.matches ? "table" : "card-stream");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleFilter = useCallback((key: string) => {
    setActiveFilters((prev) => {
      if (key === "all") return ["all"];
      const without = prev.filter((f) => f !== "all");
      if (without.includes(key)) {
        const next = without.filter((f) => f !== key);
        return next.length === 0 ? ["all"] : next;
      }
      return [...without, key];
    });
  }, []);

  // toggleExpand: fetch duplicates on first expand only (PRESERVED from original)
  async function toggleExpand(reportId: string) {
    const isNowExpanding = !expandedRows[reportId];
    setExpandedRows((prev) => ({ ...prev, [reportId]: isNowExpanding }));

    // Fetch duplicates on first expand only
    if (isNowExpanding && duplicateRows[reportId] === undefined) {
      try {
        const dupes = await getDuplicatesForReport(reportId);
        setDuplicateRows((prev) => ({ ...prev, [reportId]: dupes }));
      } catch {
        setDuplicateRows((prev) => ({ ...prev, [reportId]: [] }));
      }
    }
  }

  // ── Filter chips data ────────────────────────────────────────────────────────
  const openCount = reports.filter((r) => r.status === "open").length;
  const inReviewCount = reports.filter((r) => r.status === "acknowledged").length;
  const highSevCount = reports.filter((r) => r.severity === "high").length;

  const filterChips = [
    { key: "all",          label: "ALL",       count: reports.length },
    { key: "open",         label: "OPEN",      count: openCount },
    { key: "acknowledged", label: "IN REVIEW", count: inReviewCount },
    { key: "sev_high",     label: "SEV: HIGH", count: highSevCount },
  ];

  // ── Apply filters ────────────────────────────────────────────────────────────
  const filteredReports = reports.filter((r) => {
    if (activeFilters.includes("all")) return true;
    const hasStatusFilter = activeFilters.some((f) => f === "open" || f === "acknowledged");
    const hasSevFilter = activeFilters.includes("sev_high");
    const passesStatus = !hasStatusFilter || activeFilters.includes(r.status);
    const passesSev = !hasSevFilter || r.severity === "high";
    return passesStatus && passesSev;
  }).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      getCategoryLabel(r.category).en.toLowerCase().includes(q) ||
      (r.ward_name ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div data-testid="reports-table-loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 48,
              background: "var(--surface-2)",
              borderRadius: "var(--r-md)",
            }}
          />
        ))}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!reports || reports.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "32px 0",
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}>
        No reports found
      </div>
    );
  }

  // ── Shared filter strip + search ─────────────────────────────────────────────
  const filterStrip = (
    <div style={{ marginBottom: 12 }}>
      {/* Filter chips — horizontal scrollable, no-scrollbar */}
      <div
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          marginBottom: 8,
          paddingBottom: 2,
        }}
      >
        {filterChips.map((chip) => {
          const isActive = activeFilters.includes(chip.key);
          return (
            <button
              key={chip.key}
              onClick={() => toggleFilter(chip.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: "var(--r-xs)",
                border: isActive
                  ? "1px solid var(--ink)"
                  : "1px solid var(--border-strong)",
                background: isActive ? "var(--ink)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--ink-2)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {chip.label}
              <span style={{ fontWeight: 600, opacity: 0.7 }}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + Sort row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <Input
            icon="search"
            placeholder="Filter · ward · id · text…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            wrapperStyle={{ minHeight: 34, height: 34 }}
            style={{ fontSize: 13 }}
          />
        </div>
        <Btn variant="ghost" size="sm" aria-label="Sort reports" icon="sort">
          Sort
        </Btn>
      </div>
    </div>
  );

  // ── View mode toggle (mobile only) ───────────────────────────────────────────
  const viewToggle = viewMode !== "table" ? (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {(["card-stream", "compact-rows"] as const).map((mode) => {
        const label = mode === "card-stream" ? "CARDS" : "ROWS";
        const isActive = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--r-xs)",
              border: isActive ? "1px solid var(--ink)" : "1px solid var(--border-strong)",
              background: isActive ? "var(--ink)" : "transparent",
              color: isActive ? "var(--bg)" : "var(--ink-2)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  ) : null;

  // ── Pagination ───────────────────────────────────────────────────────────────
  const pagination = onPageChange && totalPages > 1 ? (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
      justifyContent: "flex-end",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--muted)",
      }}>
        {((page - 1) * 20) + 1}–{Math.min(page * 20, totalCount ?? 0)} / {totalCount ?? 0}
      </span>
      <Btn
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        icon="chevron_left"
      >
        Prev
      </Btn>
      <Btn
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        iconRight="chevron_right"
      >
        Next
      </Btn>
    </div>
  ) : null;

  // ── Card stream mode ─────────────────────────────────────────────────────────
  if (viewMode === "card-stream") {
    return (
      <div>
        {filterStrip}
        {viewToggle}
        <div>
          {filteredReports.map((report) => (
            <CardStreamRow
              key={report.id}
              report={report}
              role={role}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
              expandedRows={expandedRows}
              duplicateRows={duplicateRows}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
        {pagination}
      </div>
    );
  }

  // ── Compact rows mode ────────────────────────────────────────────────────────
  if (viewMode === "compact-rows") {
    const groups = groupByDay(filteredReports);
    return (
      <div>
        {filterStrip}
        {viewToggle}
        <div>
          {groups.map((group) => (
            <div key={group.label}>
              {/* Day separator */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                color: "var(--muted)",
                letterSpacing: "0.06em",
                padding: "12px 0 4px",
                borderBottom: "1px solid var(--border)",
                marginBottom: 4,
              }}>
                {group.label} · {new Date(group.items[0].created_at).toLocaleString("en", { month: "short" }).toUpperCase()} {new Date(group.items[0].created_at).getDate()}
              </div>
              {group.items.map((report) => (
                <CompactRow
                  key={report.id}
                  report={report}
                  role={role}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onUpdateStatus={onUpdateStatus}
                  expandedRows={expandedRows}
                  duplicateRows={duplicateRows}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          ))}
        </div>
        {pagination}
      </div>
    );
  }

  // ── Desktop columnar table ───────────────────────────────────────────────────
  return (
    <div>
      {filterStrip}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "auto",
          }}
        >
          <thead style={{ background: "var(--surface-2)" }}>
            <tr>
              {/* Phase 03: CORP column added between WARD and SEV (UI-SPEC §F) */}
              {["ID", "TIME", "CATEGORY", "WARD", "CORP", "SEV", "STATUS", "DUP", "ACTIONS"].map((col) => (
                <th
                  key={col}
                  scope="col"
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.10em",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => {
              const categoryLabel = getCategoryLabel(report.category).en;
              const dupCount = report.duplicate_count ?? 0;
              const sevValue = getSevLevel(report.severity);

              return (
                <React.Fragment key={report.id}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {/* ID + thumbnail */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <a href={`/admin/reports/${report.id}`} style={{ lineHeight: 0 }}>
                          <PhotoTile
                            size={32}
                            radius="var(--r-xs)"
                            src={report.image_path ? `${API_BASE_URL}/uploads/${report.image_path}` : undefined}
                            alt=""
                          />
                        </a>
                        <a
                          href={`/admin/reports/${report.id}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--ink-2)",
                            whiteSpace: "nowrap",
                            textDecoration: "underline",
                            textDecorationColor: "var(--muted)",
                          }}
                        >
                          WLK-{report.id.slice(0, 5).toUpperCase()}
                        </a>
                        {/* ABUSE-06: Duplicate label for reports that are duplicates */}
                        {report.duplicate_of_id && (
                          <span
                            data-testid="duplicate-label"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 9,
                              color: "var(--muted)",
                              fontStyle: "italic",
                            }}
                          >
                            Duplicate
                          </span>
                        )}
                        {/* ABUSE-06: Duplicate count badge + expand for original reports */}
                        {dupCount > 0 && (
                          <DupeExpandButton
                            reportId={report.id}
                            dupCount={dupCount}
                            expandedRows={expandedRows}
                            onToggle={toggleExpand}
                          />
                        )}
                      </div>
                    </td>

                    {/* TIME */}
                    <td style={{
                      padding: "10px 12px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                    }}>
                      {getRelativeTime(report.created_at)}
                    </td>

                    {/* CATEGORY + DESC */}
                    <td style={{ padding: "10px 12px", maxWidth: 200 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        marginBottom: 2,
                      }}>
                        {categoryLabel}
                      </div>
                      {report.description && (
                        <div style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                        }}>
                          {report.description}
                        </div>
                      )}
                    </td>

                    {/* WARD */}
                    <td style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "var(--ink-2)",
                      whiteSpace: "nowrap",
                    }}>
                      {report.ward_name ?? "—"}
                    </td>

                    {/* CORP — Phase 03 (UI-SPEC §F): corporation from ward JOIN */}
                    <td style={{
                      padding: "10px 12px",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-2)",
                      whiteSpace: "nowrap",
                      textTransform: "uppercase",
                    }}>
                      {(report as unknown as {corporation?: string | null}).corporation
                        ?? (report as unknown as {ward_hierarchy?: {corporation?: string | null}}).ward_hierarchy?.corporation
                        ?? "—"}
                    </td>

                    {/* SEV */}
                    <td style={{ padding: "10px 12px" }}>
                      <SeverityIndicator severity={sevValue} />
                    </td>

                    {/* STATUS — StatusBadge per component spec */}
                    <td style={{ padding: "10px 12px" }}>
                      <StatusBadge status={report.status} />
                    </td>

                    {/* DUP */}
                    <td style={{ padding: "10px 12px" }}>
                      {dupCount > 0 ? (
                        <Pill tone="warn" size="sm" style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          textTransform: "uppercase",
                        }}>
                          {dupCount}×
                        </Pill>
                      ) : (
                        <span style={{ color: "var(--muted-2)", fontSize: 10, fontFamily: "var(--font-mono)" }}>—</span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Btn
                          variant="ghost"
                          size="xs"
                          onClick={() => (onUpdateStatus ?? onStatusChange)(report.id)}
                          aria-label={`Change status for report ${report.id}`}
                        >
                          Change Status
                        </Btn>
                        {role === "admin" && (
                          <Btn
                            variant="danger-soft"
                            size="xs"
                            onClick={() => onDelete(report.id)}
                            aria-label={`Delete report ${report.id}`}
                            data-testid="delete-button"
                          >
                            Delete
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ABUSE-06: Expandable inline sub-table of duplicate reports */}
                  {expandedRows[report.id] && (
                    <tr key={`${report.id}-duplicates`}>
                      <td colSpan={COLUMN_COUNT} style={{ padding: 0 }}>
                        <div
                          data-testid="duplicate-group"
                          style={{
                            background: "var(--warn-bg)",
                            border: "1px dashed var(--warn-border)",
                            padding: "8px 12px",
                          }}
                        >
                          <p style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: "var(--muted)",
                            marginBottom: 6,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}>
                            Duplicate reports linked to this location:
                          </p>
                          <DupeSubTable duplicates={duplicateRows[report.id]} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}
