"use client";

export interface SparkbarsProps {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
  gap?: number;
}

export function Sparkbars({
  values,
  color = "var(--ink-2)",
  height = 40,
  width = 240,
  gap = 2,
}: SparkbarsProps): JSX.Element {
  const max = Math.max(...values, 1);
  const barW = (width - gap * (values.length - 1)) / Math.max(values.length, 1);

  return (
    <svg
      data-component="sparkbars"
      width={width}
      height={height}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            fill={color}
            rx="1"
          />
        );
      })}
    </svg>
  );
}
