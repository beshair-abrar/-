"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtNumber } from "@/lib/format";

/** Categorical slots — validated (light surface, all-pairs CVD ΔE ≥ 8.5, contrast ≥ 3:1). Fixed order, never cycled. */
export const SERIES = ["#1d4ed8", "#b7860b", "#12895f"] as const;
const GRID = "#e2e7ef";
const AXIS = { fontSize: 12, fill: "#64748b", fontFamily: "var(--font)" };

type TipRow = { name: string; value: string; color?: string };
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="chart-tooltip">
      <div className="t-title">{title}</div>
      {rows.map((r) => (
        <div className="t-row" key={r.name}>
          {r.color && <span className="swatch" style={{ background: r.color }} />}
          <span>{r.name}:</span>
          <strong className="num">{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RTip = { active?: boolean; payload?: readonly any[]; label?: any };

/* ---------------- Status donut ---------------- */
export function StatusDonut({ data }: { data: { label: string; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="row" style={{ alignItems: "center", gap: 20 }}>
      <div style={{ width: 200, height: 200, position: "relative", direction: "ltr" }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={data.filter((d) => d.count).length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={SERIES[i]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: RTip) =>
                active && payload?.length ? (
                  <Tip title={payload[0].name} rows={[{ name: "عدد المشاريع", value: `${payload[0].value} (${Math.round((payload[0].value / total) * 100)}%)` }]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{total}</div>
            <div className="muted small">مشروع</div>
          </div>
        </div>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 150 }}>
        {data.map((d, i) => (
          <li key={d.label} className="row-between" style={{ fontSize: 14 }}>
            <span className="row" style={{ gap: 8 }}>
              <span className="swatch" style={{ background: SERIES[i] }} />
              {d.label}
            </span>
            <span className="num" style={{ fontWeight: 600 }}>
              {d.count}
              <span className="muted small"> · {total ? Math.round((d.count / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Vertical bars over a category axis (months / years) ---------------- */
export function ColumnChart({
  data,
  xKey,
  yKey,
  name,
  color = SERIES[0],
  format = fmtNumber,
  allowDecimals = false,
  height = 260,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  name: string;
  color?: string;
  format?: (n: number) => string;
  allowDecimals?: boolean;
  height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={allowDecimals} tickFormatter={(v) => fmtCompact(v)} width={48} />
          <Tooltip cursor={{ fill: "rgba(29,78,216,0.06)" }} content={({ active, payload, label }: RTip) => (active && payload?.length ? <Tip title={String(label)} rows={[{ name, value: format(payload[0].value), color }]} /> : null)} />
          <Bar dataKey={yKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Horizontal bars (ranked categories). Labels on the right for RTL. ---------------- */
export function RankedBars({
  data,
  name,
  color = SERIES[0],
  format = fmtNumber,
  allowDecimals = false,
}: {
  data: { label: string; value: number }[];
  name: string;
  color?: string;
  format?: (n: number) => string;
  allowDecimals?: boolean;
}) {
  const height = Math.max(160, data.length * 40 + 40);
  const hasNeg = data.some((d) => d.value < 0);
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" reversed tick={AXIS} tickLine={false} axisLine={false} allowDecimals={allowDecimals} tickFormatter={(v) => fmtCompact(v)} />
          <YAxis type="category" dataKey="label" orientation="right" tick={{ ...AXIS, fill: "#334155" }} tickLine={false} axisLine={false} width={150} />
          {hasNeg && <ReferenceLine x={0} stroke="#94a3b8" />}
          <Tooltip cursor={{ fill: "rgba(29,78,216,0.06)" }} content={({ active, payload, label }: RTip) => (active && payload?.length ? <Tip title={String(label)} rows={[{ name, value: format(payload[0].value), color }]} /> : null)} />
          <Bar dataKey="value" name={name} fill={color} radius={[4, 0, 0, 4]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Grouped bars: two series on one axis ---------------- */
export function GroupedColumns({
  data,
  xKey,
  series,
  format = fmtNumber,
  height = 280,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; name: string }[];
  format?: (n: number) => string;
  height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v)} width={52} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Tooltip
            cursor={{ fill: "rgba(29,78,216,0.06)" }}
            content={({ active, payload, label }: RTip) =>
              active && payload?.length ? <Tip title={String(label)} rows={payload.map((p, i) => ({ name: p.name, value: format(p.value), color: SERIES[i] }))} /> : null
            }
          />
          <Legend verticalAlign="top" align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, paddingBottom: 8, direction: "rtl" }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Tornado: ΔNPV for −δ / +δ per variable ---------------- */
export function Tornado({ data, deltaPct, format = fmtNumber }: { data: { label: string; low: number | null; high: number | null }[]; deltaPct: number; format?: (n: number) => string }) {
  const rows = data.map((d) => ({ label: d.label, low: d.low ?? 0, high: d.high ?? 0 }));
  const height = Math.max(200, rows.length * 44 + 60);
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 4, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v)} />
          <YAxis type="category" dataKey="label" orientation="right" tick={{ ...AXIS, fill: "#334155" }} tickLine={false} axisLine={false} width={170} />
          <ReferenceLine x={0} stroke="#475569" />
          <Tooltip
            cursor={{ fill: "rgba(29,78,216,0.06)" }}
            content={({ active, payload, label }: RTip) =>
              active && payload?.length ? (
                <Tip title={String(label)} rows={payload.map((p, i) => ({ name: p.name, value: `${p.value > 0 ? "+" : ""}${format(p.value)}`, color: SERIES[i] }))} />
              ) : null
            }
          />
          <Legend verticalAlign="top" align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, paddingBottom: 8, direction: "rtl" }} />
          <Bar dataKey="low" name={`انخفاض ${deltaPct}%`} stackId="s" fill={SERIES[0]} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="high" name={`ارتفاع ${deltaPct}%`} stackId="s" fill={SERIES[1]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
