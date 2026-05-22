"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
  children: ReactNode;
}

export function Card({
  padded = true,
  hoverable = false,
  children,
  style,
  className,
  ...rest
}: CardProps): JSX.Element {
  const baseStyle: CSSProperties = {
    background: "var(--surface)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-sm)",
    border: "1px solid var(--border)",
    padding: padded ? 16 : 0,
    ...style,
  };

  return (
    <div
      data-component="card"
      data-padded={String(padded)}
      data-hoverable={String(hoverable)}
      className={hoverable ? `press${className ? ` ${className}` : ""}` : className}
      style={baseStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
