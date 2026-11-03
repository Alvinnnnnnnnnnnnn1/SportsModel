"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate } from "@/lib/utils";
const colors = ["#80e8b0", "#92b4e8", "#c5adf2", "#e3bf7a", "#b7c9bd"];
const tooltipStyle = {
  background: "#19231c",
  border: "1px solid #34453a",
  borderRadius: 8,
  fontSize: 11,
  color: "#eaf0ed",
};
export function PerformanceChart({
  data,
  field = "profit",
}: {
  data: { date: string; profit: number; bankroll: number }[];
  field?: "profit" | "bankroll";
}) {
  if (data.length < 2)
    return (
      <div className="empty-state h-[250px]">
        Performance will appear after activity on at least two dates.
      </div>
    );
  return (
    <div
      className="h-[250px] w-full"
      aria-label={`${field === "profit" ? "Realised profit and loss" : "Available bankroll"} over time in AUD`}
      role="img"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`fill-${field}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#80e8b0" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#80e8b0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#29372e"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => shortDate(`${value}T12:00:00Z`)}
            tick={{ fill: "#778b7e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={35}
            dy={10}
          />
          <YAxis
            tickFormatter={(value) => `$${value}`}
            tick={{ fill: "#778b7e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(value) => shortDate(`${value}T12:00:00Z`)}
            formatter={(value) => [
              `$${Number(value).toFixed(2)}`,
              field === "profit" ? "Realised P/L" : "Available cash",
            ]}
          />
          <ReferenceLine y={0} stroke="#405647" strokeDasharray="3 5" />
          <Area
            type="linear"
            dataKey={field}
            stroke="#80e8b0"
            strokeWidth={2}
            fill={`url(#fill-${field})`}
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "#152b1d", strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function GroupChart({
  data,
}: {
  data: { name: string; profit: number; bets: number }[];
}) {
  if (!data.length)
    return <div className="empty-state">No confirmed bets in this view.</div>;
  return (
    <div
      className="h-[240px]"
      role="img"
      aria-label="Realised profit and loss by group in AUD"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 20, left: -15, right: 10, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#29372e"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#889b8e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fill: "#778b7e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "#ffffff04" }}
            contentStyle={tooltipStyle}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "Realised P/L"]}
          />
          <ReferenceLine y={0} stroke="#506358" />
          <Bar
            dataKey="profit"
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
            isAnimationActive={false}
          >
            {data.map((item, i) => (
              <Cell
                key={item.name}
                fill={item.profit < 0 ? "#e58e8e" : colors[i % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CalibrationChart({
  data,
}: {
  data: { bucket: string; predicted: number; actual: number; count: number }[];
}) {
  if (!data.length)
    return (
      <div className="empty-state h-64">
        No settled predictions with registered probabilities.
      </div>
    );
  return (
    <div
      className="h-[250px]"
      role="img"
      aria-label="Registered probabilities compared with observed win frequency by decile"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 15, left: -20, right: 15, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#29372e"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="bucket"
            tick={{ fill: "#889b8e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#778b7e", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label, payload) =>
              `${label} · n=${payload?.[0]?.payload?.count ?? 0}`
            }
            formatter={(v, name) => [
              `${Number(v).toFixed(1)}%`,
              name === "predicted"
                ? "Registered probability"
                : "Observed frequency",
            ]}
          />
          <Line
            dataKey="predicted"
            stroke="#8196b5"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            stroke="#80e8b0"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
