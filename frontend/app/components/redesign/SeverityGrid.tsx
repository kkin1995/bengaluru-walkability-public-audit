"use client";

import { Bi } from "@/app/components/ui/Bi";

interface SeverityItem {
  value: string;
  en: string;
  kn: string;
  hint: string;
  bg: string;
  border: string;
  ink: string;
}

const SEVERITY_ITEMS: SeverityItem[] = [
  {
    value: "low",
    en: "Minor",
    kn: "ಸಣ್ಣ",
    hint: "Inconvenient but passable",
    bg: "var(--accent-bg)",
    border: "var(--accent-border)",
    ink: "var(--accent-ink)",
  },
  {
    value: "medium",
    en: "Moderate",
    kn: "ಮಧ್ಯಮ",
    hint: "Risky for some pedestrians",
    bg: "var(--warn-bg)",
    border: "oklch(0.85 0.08 75)",
    ink: "oklch(0.4 0.14 75)",
  },
  {
    value: "high",
    en: "Urgent",
    kn: "ತುರ್ತು",
    hint: "Immediate danger",
    bg: "var(--danger-bg)",
    border: "oklch(0.85 0.08 30)",
    ink: "var(--danger)",
  },
];

interface SeverityGridProps {
  value: string;
  onChange: (value: string) => void;
}

export function SeverityGrid({ value, onChange }: SeverityGridProps) {
  const activeHint = SEVERITY_ITEMS.find((s) => s.value === value)?.hint ?? "";
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Severity"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        {SEVERITY_ITEMS.map((s) => {
          const active = value === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s.value)}
              className="press"
              style={{
                padding: "12px 8px",
                borderRadius: "var(--r-md)",
                background: active ? s.bg : "var(--surface)",
                border: `1.5px solid ${active ? s.border : "var(--border)"}`,
                color: active ? s.ink : "var(--ink-2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                fontWeight: 500,
                minHeight: 56,
                cursor: "pointer",
              }}
            >
              <Bi en={s.en} kn={s.kn} style={{ fontSize: 13, fontWeight: 600, alignItems: "center" }} />
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8, marginBottom: 0 }}>
        {activeHint}
      </p>
    </div>
  );
}
