import type { CSSProperties, ReactNode } from "react";

export interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Uppercase mono section header. 11px is a component-level override
 * (NOT a 5th typography scale size — see UI-SPEC Typography section).
 */
export function SectionLabel({ children, className, style }: SectionLabelProps) {
  return (
    <div
      className={className}
      data-component="section-label"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
