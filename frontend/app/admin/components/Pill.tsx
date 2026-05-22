"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export type PillTone = "neutral" | "outline" | "accent" | "danger" | "warn" | "info" | "ink";
export type PillSize = "sm" | "md" | "lg";

export interface PillProps {
  tone?: PillTone;
  size?: PillSize;
  dot?: string;
  icon?: IconName;
  children: ReactNode;
  style?: CSSProperties;
}

const TONES: Record<PillTone, CSSProperties> = {
  neutral:  { background: "var(--surface-2)",   color: "var(--ink-2)",      border: "1px solid var(--border)" },
  outline:  { background: "transparent",        color: "var(--ink-2)",      border: "1px solid var(--border-strong)" },
  accent:   { background: "var(--accent-bg)",   color: "var(--accent-ink)", border: "1px solid var(--accent-border)" },
  danger:   { background: "var(--danger-bg)",   color: "var(--danger-ink)", border: "1px solid var(--danger-border)" },
  warn:     { background: "var(--warn-bg)",     color: "var(--warn-ink)",   border: "1px solid var(--warn-border)" },
  info:     { background: "var(--info-bg)",     color: "var(--info-ink)",   border: "1px solid var(--info-border)" },
  ink:      { background: "var(--ink)",         color: "var(--bg)",         border: "1px solid var(--ink)" },
};

const SIZES: Record<PillSize, CSSProperties> = {
  sm: { padding: "2px 8px",  fontSize: 11, gap: 5, borderRadius: "var(--r-full)" },
  md: { padding: "4px 10px", fontSize: 12, gap: 6, borderRadius: "var(--r-full)" },
  lg: { padding: "6px 12px", fontSize: 13, gap: 7, borderRadius: "var(--r-full)" },
};

export function Pill({
  tone = "neutral",
  size = "md",
  dot,
  icon,
  children,
  style,
}: PillProps): JSX.Element {
  const composedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...SIZES[size],
    ...TONES[tone],
    ...style,
  };

  return (
    <span
      data-component="pill"
      data-tone={tone}
      data-size={size}
      style={composedStyle}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: dot,
            flexShrink: 0,
          }}
        />
      )}
      {icon && <Icon name={icon} size={12} aria-hidden={true} />}
      {children}
    </span>
  );
}
