"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName;
  suffix?: ReactNode;
  wrapperStyle?: CSSProperties;
}

export function Input({
  icon,
  suffix,
  wrapperStyle,
  style,
  ...rest
}: InputProps): JSX.Element {
  return (
    <label
      data-component="input"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-xs)",
        padding: "0 12px",
        minHeight: 44,
        gap: 8,
        ...wrapperStyle,
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={14}
          style={{ color: "var(--muted)", flexShrink: 0 }}
          aria-hidden={true}
        />
      )}
      <input
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--ink)",
          fontSize: 14,
          fontFamily: "inherit",
          minWidth: 0,
          ...style,
        }}
        {...rest}
      />
      {suffix}
    </label>
  );
}
