import type { CSSProperties, ReactNode } from "react";

export type PillTone = "neutral" | "accent" | "ink" | "glass" | "warn";

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const TONES: Record<PillTone, CSSProperties> = {
  neutral: { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border)" },
  accent:  { background: "var(--accent-bg)", color: "var(--accent-ink)", border: "1px solid var(--accent-border)" },
  ink:     { background: "var(--ink)", color: "#fafaf9", border: "1px solid var(--ink)" },
  glass:   { background: "rgba(255,255,255,0.92)", color: "var(--ink)", border: "1px solid rgba(28,25,23,0.08)", backdropFilter: "blur(12px)" },
  warn:    { background: "var(--warn-bg)", color: "oklch(0.4 0.14 75)", border: "1px solid oklch(0.85 0.08 75)" },
};

export function Pill({ tone = "neutral", children, className, style }: PillProps) {
  return (
    <span
      className={className}
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: "var(--r-full)",
        fontSize: 12,
        fontWeight: 500,
        ...TONES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
