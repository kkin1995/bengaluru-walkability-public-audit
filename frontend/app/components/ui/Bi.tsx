import type { CSSProperties } from "react";

export interface BiProps {
  en: string;
  kn?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Bilingual stacked text span. Renders English above Kannada (if provided).
 * CSS classes `.bi`, `.bi-en`, `.bi-kn` are defined in globals.css.
 */
export function Bi({ en, kn, className = "", style }: BiProps) {
  return (
    <span className={`bi ${className}`.trim()} style={style}>
      <span className="bi-en">{en}</span>
      {kn && <span className="bi-kn">{kn}</span>}
    </span>
  );
}
