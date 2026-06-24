"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { LegendPayload } from "recharts/types/component/DefaultLegendContent";
import { useState, useRef, useEffect } from "react";
import type { TrendDataPoint } from "../lib/adminApi";
import { getCategoryLabel } from "@/app/lib/translations";

interface TrendChartProps {
  data: TrendDataPoint[];
  // WR-06: selectedWard was previously accepted but never used for actual data filtering.
  // Displaying "FILTERED: {wardName}" while showing unfiltered global data was misleading.
  // The prop has been removed; trend data is always system-wide.
  // MOB-04: optional legend formatter; falls back to getCategoryLabel if not provided
  legendFormatter?: (value: string) => string;
}

const CATEGORY_COLORS: Record<string, string> = {
  broken_footpath: "#e53e3e",
  blocked_footpath: "#dd6b20",
  no_footpath: "#2b6cb0",
  unsafe_crossing: "#553c9a",
  poor_lighting: "#b7791f",
  encroachment: "#276749",
  no_curb_ramp: "#2c7a7b",
  other: "#718096",
};

const CHART_HEIGHT = 300;

function transformTrendData(data: TrendDataPoint[]): Record<string, unknown>[] {
  const byWeek: Record<string, Record<string, unknown>> = {};
  const allCategories = new Set<string>();
  for (const d of data) {
    allCategories.add(d.category);
    if (!byWeek[d.week_start]) byWeek[d.week_start] = { week_start: d.week_start };
    byWeek[d.week_start][d.category] = d.count;
  }
  // Fill missing category/week pairs with 0 so Recharts draws continuous line segments.
  // Without this, a category absent from a week produces an isolated point that is
  // invisible with dot={false}, making the chart appear blank on sparse datasets.
  for (const week of Object.values(byWeek)) {
    for (const cat of Array.from(allCategories)) {
      if (week[cat] === undefined) week[cat] = 0;
    }
  }
  return Object.values(byWeek).sort((a, b) =>
    String(a.week_start) < String(b.week_start) ? -1 : 1
  );
}

export default function TrendChart({ data, legendFormatter }: TrendChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  // MOB-03 re-fix: self-measuring wrapper eliminates the deferred-measurement race.
  //
  // Root cause: the previous approach used a wrapping component that relies on a
  // ResizeObserver to measure its parent before Recharts computes each Line's SVG
  // path `d` attribute. On mobile (and Chrome simulated mobile) the container's
  // measured width arrives after first paint (0 on initial render), so Recharts
  // computes geometry against a zero width — the line `d` is empty and only the
  // static grid/axes paint. isAnimationActive={false} cannot fix this because
  // the geometry itself is never computed.
  //
  // Fix: measure the outer div with a ResizeObserver into React state and pass
  // an explicit numeric width={width} to LineChart directly. With concrete
  // numbers, Recharts computes the path `d` synchronously on render. Render
  // LineChart only once width > 0 so Recharts never computes against zero.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial synchronous measurement
    const measured = el.getBoundingClientRect().width || el.clientWidth;
    if (measured > 0) setWidth(measured);

    // Watch for container resize (orientation change, viewport resize)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLegendClick = (entry: LegendPayload) => {
    const key = String(entry.dataKey ?? "");
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chartData = transformTrendData(data);
  const categories = Array.from(new Set(data.map((d) => d.category)));

  return (
    // Outer div: full-width, fixed pixel height so the measuring ref always has
    // a concrete bounding rect to read. The ResizeObserver on this element
    // reports its width into state; LineChart is rendered only when width > 0.
    <div ref={containerRef} style={{ width: "100%", height: CHART_HEIGHT }}>
      {width > 0 && (
        <LineChart data={chartData} width={width} height={CHART_HEIGHT}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="week_start"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [value, getCategoryLabel(String(name)).en]}
          />
          {/* MOB-04: legend formatter maps raw DB enum strings to human-readable labels */}
          <Legend
            onClick={handleLegendClick}
            formatter={(value: string) =>
              legendFormatter ? legendFormatter(value) : getCategoryLabel(value).en
            }
          />
          {categories.map((cat) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={CATEGORY_COLORS[cat] ?? "#718096"}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              hide={hiddenLines.has(cat)}
            />
          ))}
        </LineChart>
      )}
    </div>
  );
}
