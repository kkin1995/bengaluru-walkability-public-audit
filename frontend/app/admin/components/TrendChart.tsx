"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { LegendPayload } from "recharts/types/component/DefaultLegendContent";
import { useState } from "react";
import type { TrendDataPoint } from "../lib/adminApi";

interface TrendChartProps {
  data: TrendDataPoint[];
  // WR-06: selectedWard was previously accepted but never used for actual data filtering.
  // Displaying "FILTERED: {wardName}" while showing unfiltered global data was misleading.
  // The prop has been removed; trend data is always system-wide.
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

function transformTrendData(data: TrendDataPoint[]): Record<string, unknown>[] {
  const byWeek: Record<string, Record<string, unknown>> = {};
  for (const d of data) {
    if (!byWeek[d.week_start]) byWeek[d.week_start] = { week_start: d.week_start };
    byWeek[d.week_start][d.category] = d.count;
  }
  return Object.values(byWeek).sort((a, b) =>
    String(a.week_start) < String(b.week_start) ? -1 : 1
  );
}

export default function TrendChart({ data }: TrendChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

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
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="week_start"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
          <Tooltip />
          <Legend onClick={handleLegendClick} />
          {categories.map((cat) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={CATEGORY_COLORS[cat] ?? "#718096"}
              strokeWidth={2}
              dot={false}
              hide={hiddenLines.has(cat)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
