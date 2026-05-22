"use client";

import type { CSSProperties, ReactNode } from "react";

export interface KbdProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Kbd({ children, style }: KbdProps): JSX.Element {
  return (
    <span
      data-component="kbd"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        border: "1px solid var(--border-strong)",
        borderBottomWidth: 2,
        borderRadius: "var(--r-sm)",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: "var(--ink-2)",
        background: "var(--surface)",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
