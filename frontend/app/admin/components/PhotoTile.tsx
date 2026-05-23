"use client";

import type { CSSProperties } from "react";

export interface PhotoTileProps {
  size?: number;
  radius?: number | string;
  alt?: string;
  src?: string;
  style?: CSSProperties;
}

export function PhotoTile({
  size = 64,
  radius = "var(--r-xs)",
  alt,
  src,
  style,
}: PhotoTileProps): JSX.Element {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        data-component="photo-tile"
        src={src}
        alt={alt ?? ""}
        width={size}
        height={size}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <span
      data-component="photo-tile"
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
