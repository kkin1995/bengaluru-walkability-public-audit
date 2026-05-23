"use client";

import type { CSSProperties, SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: IconName;
  wrapperStyle?: CSSProperties;
}

export function Select({
  icon,
  wrapperStyle,
  style,
  children,
  ...rest
}: SelectProps): JSX.Element {
  return (
    <label
      data-component="select"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: 36,
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        padding: "0 10px 0 12px",
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
      <select
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--ink)",
          fontSize: 13,
          fontFamily: "inherit",
          minWidth: 0,
          appearance: "none",
          cursor: "pointer",
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron_down"
        size={14}
        style={{ color: "var(--muted)", flexShrink: 0, pointerEvents: "none" }}
        aria-hidden={true}
      />
    </label>
  );
}
