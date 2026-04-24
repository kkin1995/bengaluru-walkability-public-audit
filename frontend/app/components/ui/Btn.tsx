import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type BtnVariant = "primary" | "accent" | "secondary" | "ghost";
export type BtnSize = "sm" | "md" | "lg" | "xl";

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  children: React.ReactNode;
}

const SIZES: Record<BtnSize, CSSProperties> = {
  sm: { padding: "10px 14px", fontSize: 13, borderRadius: "var(--r-md)", minHeight: 44 },
  md: { padding: "14px 20px", fontSize: 15, borderRadius: "var(--r-lg)", minHeight: 44 },
  lg: { padding: "18px 24px", fontSize: 16, borderRadius: "var(--r-xl)", minHeight: 56 },
  xl: { padding: "22px 24px", fontSize: 17, borderRadius: "var(--r-xl)", minHeight: 64 },
};

const VARIANTS: Record<BtnVariant, CSSProperties> = {
  primary:   { background: "var(--ink)", color: "#fafaf9", fontWeight: 600 },
  accent:    { background: "var(--accent)", color: "#fff", fontWeight: 600 },
  secondary: { background: "var(--surface)", color: "var(--ink)", fontWeight: 500, border: "1px solid var(--border-strong)" },
  ghost:     { background: "transparent", color: "var(--ink)", fontWeight: 500 },
};

export function Btn({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  style,
  children,
  ...rest
}: BtnProps) {
  const merged: CSSProperties = {
    ...SIZES[size],
    ...VARIANTS[variant],
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    border: VARIANTS[variant].border ?? "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
    ...style,
  };
  return (
    <button
      className={`press ${className}`.trim()}
      data-variant={variant}
      data-size={size}
      style={merged}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
