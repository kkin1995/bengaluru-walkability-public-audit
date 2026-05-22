"use client";

import type { CSSProperties } from "react";

export type StatusValue = "submitted" | "under_review" | "resolved";

export interface StatusBadgeProps {
  status: string;
  monoLabel?: boolean;
  size?: "sm" | "md";
}

interface StatusMeta {
  tone: "info" | "warn" | "accent";
  dot: string;
  label: string;
  ariaLabel: string;
  toneStyle: CSSProperties;
}

const STATUS_MAP: Record<string, StatusMeta> = {
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
  resolved: {
    tone: "accent",
    dot: "var(--status-resolved)",
    label: "Resolved",
    ariaLabel: "Status: resolved",
    toneStyle: {
      background: "var(--accent-bg)",
      color: "var(--accent-ink)",
      border: "1px solid var(--accent-border)",
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
