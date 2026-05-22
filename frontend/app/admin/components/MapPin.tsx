"use client";

import type { CSSProperties } from "react";

export interface MapPinProps {
  status: "submitted" | "under_review" | "resolved";
  size?: number;
  style?: CSSProperties;
}

export function MapPin({ status, size = 14, style }: MapPinProps): JSX.Element {
  const colorMap: Record<string, string> = {
    submitted: "var(--status-submitted)",
    under_review: "var(--status-review)",
    resolved: "var(--status-resolved)",
  };
  const color = colorMap[status] ?? colorMap.submitted;

  return (
    <span
      data-component="map-pin"
      data-status={status}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        border: "2px solid var(--surface)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
