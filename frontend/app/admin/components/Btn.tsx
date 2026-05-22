"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export type BtnVariant = "primary" | "accent" | "secondary" | "ghost" | "soft" | "danger" | "danger-soft";
export type BtnSize = "xs" | "sm" | "md" | "lg";

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  iconRight?: IconName;
}

const SIZES: Record<BtnSize, CSSProperties & { iconSize: number }> = {
  xs: { padding: "6px 10px",  fontSize: 12, borderRadius: "var(--r-sm)", minHeight: 28, gap: 6,  iconSize: 13 },
  sm: { padding: "8px 12px",  fontSize: 13, borderRadius: "var(--r-sm)", minHeight: 34, gap: 8,  iconSize: 14 },
  md: { padding: "10px 14px", fontSize: 14, borderRadius: "var(--r-md)", minHeight: 44, gap: 8,  iconSize: 16 },
  lg: { padding: "14px 18px", fontSize: 15, borderRadius: "var(--r-md)", minHeight: 48, gap: 10, iconSize: 16 },
};

const VARIANTS: Record<BtnVariant, CSSProperties> = {
  primary:      { background: "var(--ink)",         color: "var(--bg)",          fontWeight: 600 },
  accent:       { background: "var(--accent)",      color: "var(--on-accent)",   fontWeight: 600 },
  secondary:    { background: "var(--surface)",     color: "var(--ink)",         fontWeight: 500, boxShadow: "inset 0 0 0 1px var(--border-strong)" },
  ghost:        { background: "transparent",        color: "var(--ink-2)",       fontWeight: 500 },
  soft:         { background: "var(--surface-2)",   color: "var(--ink)",         fontWeight: 500 },
  danger:       { background: "var(--danger)",      color: "#fff",               fontWeight: 600 },
  "danger-soft": { background: "var(--danger-bg)", color: "var(--danger-ink)",  fontWeight: 600, boxShadow: "inset 0 0 0 1px var(--danger-border)" },
};

export function Btn({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  children,
  style,
  className,
  ...rest
}: BtnProps): JSX.Element {
  const { iconSize, ...sizeStyle } = SIZES[size];
  const variantStyle = VARIANTS[variant];

  const composedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    lineHeight: 1,
    ...sizeStyle,
    ...variantStyle,
    ...style,
  };

  return (
    <button
      data-component="btn"
      data-variant={variant}
      data-size={size}
      className={`press${className ? ` ${className}` : ""}`}
      style={composedStyle}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} aria-hidden={true} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} aria-hidden={true} />}
    </button>
  );
}
