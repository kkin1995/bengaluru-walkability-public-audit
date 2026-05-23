"use client";

import { Pill } from "./Pill";

export interface ConfidencePillProps {
  confidence: "high" | "low";
}

export function ConfidencePill({ confidence }: ConfidencePillProps): JSX.Element {
  const isHigh = confidence === "high";

  return (
    <Pill
      tone={isHigh ? "warn" : "neutral"}
      size="sm"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {isHigh ? "HIGH CONF" : "LOW CONF"}
    </Pill>
  );
}
