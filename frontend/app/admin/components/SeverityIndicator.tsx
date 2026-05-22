"use client";

import type { CSSProperties } from "react";

export type SeverityLevel = "low" | "medium" | "high";

export interface SeverityIndicatorProps {
  severity: SeverityLevel;
  style?: CSSProperties;
}

const BAR_HEIGHTS = [4, 8, 12];

const SEV_MAP: Record<SeverityLevel, { color: string; label: string; level: number }> = {
  low:    { color: "var(--sev-low)",    label: "Low",    level: 1 },
  medium: { color: "var(--sev-medium)", label: "Medium", level: 2 },
  high:   { color: "var(--sev-high)",   label: "High",   level: 3 },
};

export function SeverityIndicator({ severity, style }: SeverityIndicatorProps): JSX.Element {
  const s = SEV_MAP[severity] ?? SEV_MAP.medium;

  return (
    <span
      data-component="severity-indicator"
      data-severity={severity}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}
    >
      {/* Bars: aria-hidden — color is decorative; text label carries the semantic meaning */}
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 12 }}
      >
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: h,
              background: i < s.level ? s.color : "var(--border-strong)",
              borderRadius: 1,
            }}
          />
        ))}
      </span>
      {/* Text label: the semantic meaning — never color-only (WCAG 1.4.1) */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
          color: "var(--ink-2)",
        }}
      >
        {s.label}
      </span>
    </span>
  );
}
