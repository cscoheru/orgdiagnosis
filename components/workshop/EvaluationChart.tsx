"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { EvaluationItem } from "@/lib/api/workshop-api";

const DEFAULT_DIMENSIONS = [
  { key: "dim_x", label: "痛点极值" },
  { key: "dim_y", label: "业务价值" },
  { key: "dim_z", label: "能力鸿沟" },
];

interface EvaluationChartProps {
  items: EvaluationItem[];
}

export default function EvaluationChart({ items }: EvaluationChartProps) {
  const chartData = items.map((item) => ({
    id: item._id,
    name: item.properties.name,
    x: item.properties.dim_x,
    y: item.properties.dim_y,
    z: item.properties.dim_z,
    w: item.properties.dim_w,
  }));

  const isHighlighted = (d: (typeof chartData)[0]) => d.x > 3 && d.y > 3;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          domain={[0, 5]}
          name={DEFAULT_DIMENSIONS[0].label}
          label={{ value: DEFAULT_DIMENSIONS[0].label, position: "bottom", offset: 0 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[0, 5]}
          name={DEFAULT_DIMENSIONS[1].label}
          label={{ value: DEFAULT_DIMENSIONS[1].label, angle: -90, position: "insideLeft" }}
        />
        <ZAxis type="number" dataKey="z" range={[60, 400]} name={DEFAULT_DIMENSIONS[2].label} />
        <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="5 5" />
        <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="5 5" />
        <Tooltip
          formatter={(value, name) => [value, name]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
        />
        <Scatter data={chartData} name="评价项">
          {chartData.map((entry) => (
            <Cell
              key={entry.id}
              fill={isHighlighted(entry) ? "#ef4444" : "#3b82f6"}
              fillOpacity={isHighlighted(entry) ? 0.9 : 0.6}
              stroke={isHighlighted(entry) ? "#dc2626" : "#2563eb"}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
