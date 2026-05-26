"use client";

import type { CSSProperties } from "react";

// Phase 03 (D-03..D-05): status lifecycle expanded from 3 to 6 values.
// Legacy values (submitted, under_review) kept in STATUS_MAP for backward compat with
// any existing admin_users session tokens that still carry the old string, until
// the DB migration 008 atomically renames them on next deploy.
export type StatusValue =
  | "open"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  // Legacy values kept for backward compatibility until migration 008 applies
  | "submitted"
  | "under_review";

export interface StatusBadgeProps {
  status: string;
  monoLabel?: boolean;
  size?: "sm" | "md";
}

interface StatusMeta {
  tone: "info" | "warn" | "accent" | "muted";
  dot: string;
  label: string;
  ariaLabel: string;
  toneStyle: CSSProperties;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  // ── Phase 03 (D-03..D-05): 6-value lifecycle ────────────────────────────────
  // Ref: 03-UI-SPEC.md §"Status Color System — 6-State Admin StatusBadge"
  open: {
    tone: "info",
    dot: "var(--status-open-bg, var(--status-submitted))",
    label: "Open",
    ariaLabel: "Status: open",
    toneStyle: {
      background: "var(--status-open-bg, var(--info-bg))",
      color: "var(--info-ink)",
      border: "1px solid oklch(0.86 0.06 200)",
    },
  },
  acknowledged: {
    tone: "info",
    dot: "transparent",
    label: "Acknowledged",
    ariaLabel: "Status: acknowledged",
    toneStyle: {
      background: "var(--status-acknowledged-bg, var(--info-bg))",
      color: "var(--info-ink)",
      border: "1px solid oklch(0.86 0.06 200)",
    },
  },
  assigned: {
    tone: "warn",
    dot: "var(--status-assigned-bg, var(--status-review))",
    label: "Assigned",
    ariaLabel: "Status: assigned",
    toneStyle: {
      background: "var(--status-assigned-bg, var(--warn-bg))",
      color: "var(--warn-ink)",
      border: "1px solid oklch(0.84 0.12 60)",
    },
  },
  in_progress: {
    tone: "warn",
    dot: "var(--status-in-progress-bg, var(--status-review))",
    label: "In Progress",
    ariaLabel: "Status: in progress",
    toneStyle: {
      background: "var(--status-in-progress-bg, var(--warn-bg))",
      color: "var(--warn-ink)",
      border: "1px solid oklch(0.84 0.12 60)",
    },
  },
  resolved: {
    tone: "accent",
    dot: "var(--status-resolved)",
    label: "Resolved",
    ariaLabel: "Status: resolved",
    toneStyle: {
      background: "var(--status-resolved-bg, var(--accent-bg))",
      color: "var(--accent-ink)",
      border: "1px solid var(--accent-border)",
    },
  },
  closed: {
    tone: "muted",
    dot: "#d4d4d1",
    label: "Closed",
    ariaLabel: "Status: closed",
    toneStyle: {
      background: "#eaeae6",
      color: "var(--muted)",
      border: "1px solid #d4d4d1",
    },
  },
  // ── Legacy values (pre-migration-008) — kept for soft rollout ───────────────
  submitted: {
    tone: "info",
    dot: "var(--status-submitted)",
    label: "Submitted",
    ariaLabel: "Status: submitted",
    toneStyle: {
      background: "var(--info-bg)",
      color: "var(--info-ink)",
      border: "1px solid var(--info-border)",
    },
  },
  under_review: {
    tone: "warn",
    dot: "var(--status-review)",
    label: "Under Review",
    ariaLabel: "Status: under review",
    toneStyle: {
      background: "var(--warn-bg)",
      color: "var(--warn-ink)",
      border: "1px solid var(--warn-border)",
    },
  },
};

const SIZE_STYLE: Record<"sm" | "md", CSSProperties> = {
  sm: { padding: "2px 8px",  fontSize: 11, borderRadius: "var(--r-full)" },
  md: { padding: "4px 10px", fontSize: 12, borderRadius: "var(--r-full)" },
};

function StatusBadge({ status, monoLabel = false, size = "md" }: StatusBadgeProps): JSX.Element {
  const known = STATUS_MAP[status];
  // For unknown statuses: fall back to info tone but use the raw status value in aria-label
  const m = known ?? {
    ...STATUS_MAP.submitted,
    ariaLabel: `Status: ${status}`,
    label: status,
    dot: "var(--status-submitted)",
  };

  const monoStyle: CSSProperties = monoLabel
    ? { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase" }
    : {};

  return (
    <span
      data-component="status-badge"
      data-testid="status-badge"
      data-tone={m.tone}
      data-status={status}
      role="status"
      aria-label={m.ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...SIZE_STYLE[size],
        ...m.toneStyle,
        ...monoStyle,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: m.dot,
          flexShrink: 0,
        }}
      />
      {m.label}
    </span>
  );
}

export default StatusBadge;
