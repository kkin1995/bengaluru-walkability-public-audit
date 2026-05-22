"use client";

import type { CSSProperties, ReactNode } from "react";

export interface SectionLabelProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function SectionLabel({ children, style }: SectionLabelProps): JSX.Element {
  return (
    <div
      data-component="section-label"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "var(--muted)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
