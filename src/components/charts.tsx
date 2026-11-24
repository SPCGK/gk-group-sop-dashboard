"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { EngineResult } from "@/lib/engine";
import { monthShortId } from "@/lib/engine/dates";
import { STATUS_META } from "./status";

const AXIS = { fontSize: 11, fill: "#6b7280" };
const GRID = "#eef0f3";
const pctFmt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "N/A");
const pctTick = (v: number) => `${Math.round(v * 100)}%`;

function ChartTooltip({ active, payload, label, kind = "pct" }: { active?: boolean; payload?: Array<{ name: string; value: number | null; color: string; payload: Record<string, unknown> }>; label?: string; kind?: "pct" | "int" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-ink">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink tabular">{kind === "pct" ? pctFmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function MonthlyTargetVsActualChart({ data }: { data: EngineResult["monthly"] }) {
  const rows = data.map((m) => ({ name: monthShortId(m.month), Target: m.target, Actual: m.hasInput ? m.total : null }));
  return (
    <div className="h-64" role="img" aria-label="Grafik target vs actual bulanan">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: "#d1d5db" }} />
          <YAxis tick={AXIS} tickFormatter={pctTick} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(1, Math.ceil(max * 10) / 10)]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
          <Bar dataKey="Actual" name="Total Achievement" fill="var(--cat)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line dataKey="Target" name="Target" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: "#6b7280" }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CatVsAdditionalChart({ overall }: { overall: EngineResult["overall"] }) {
  const rows = [
    { name: "% CAT", value: overall.pctCat, color: "var(--cat)" },
    { name: "% Additional", value: overall.pctAdditional, color: "var(--additional)" },
  ];
  return (
    <div className="h-40" role="img" aria-label="Perbandingan % CAT dan % Additional">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }} barCategoryGap={18}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tickFormatter={pctTick} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#374151" }} width={86} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          <Bar dataKey="value" name="Pencapaian" radius={[0, 4, 4, 0]} maxBarSize={26}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => pctFmt(v)} style={{ fontSize: 12, fill: "#111827", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({ kpi }: { kpi: EngineResult["kpi"] }) {
  const rows = [
    { key: "Completed", value: kpi.completed },
    { key: "In Progress", value: kpi.inProgress },
    { key: "Not Started", value: kpi.notStarted },
    { key: "Not Input", value: kpi.notInput },
    { key: "Hold", value: kpi.hold },
  ] as const;
  const data = rows.map((r) => ({ name: STATUS_META[r.key].label, value: r.value, color: STATUS_META[r.key].color }));
  return (
    <div className="h-52" role="img" aria-label="Distribusi status SOP">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap={10}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#374151" }} width={96} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip kind="int" />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          <Bar dataKey="value" name="Jumlah SOP" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: "#111827", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Always draws the value – including 0% – right of the bar end; nothing for N/A.
function OrgBarLabel(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  if (value === null || value === undefined) return null;
  return (
    <text x={Number(x) + Number(width) + 4} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={10} fill="#374151">
      {pctFmt(value)}
    </text>
  );
}

export function ProgressByOrganizationChart({ organizations }: { organizations: EngineResult["organizations"] }) {
  const data = organizations
    .filter((o) => o.pctCat !== null || o.pctAdditional !== null)
    .map((o) => ({ name: o.organization.organization_name, CAT: o.pctCat, Additional: o.pctAdditional }));
  const height = Math.max(220, data.length * 44 + 60);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-ink-3">Belum ada data progres.</p>;
  return (
    <div style={{ height }} role="img" aria-label="Progres per organisasi">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }} barGap={2} barCategoryGap={10}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tickFormatter={pctTick} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#374151" }} width={110} tickLine={false} axisLine={false} interval={0} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(17,24,39,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
          <Bar dataKey="CAT" name="% CAT" fill="var(--cat)" radius={[0, 4, 4, 0]} maxBarSize={14}>
            <LabelList dataKey="CAT" position="right" content={OrgBarLabel} />
          </Bar>
          <Bar dataKey="Additional" name="% Additional" fill="var(--additional)" radius={[0, 4, 4, 0]} maxBarSize={14}>
            <LabelList dataKey="Additional" position="right" content={OrgBarLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompletionTrendChart({ data }: { data: EngineResult["monthly"] }) {
  const rows = data.map((m) => ({ name: monthShortId(m.month), Completion: m.completionInput, Awareness: m.awarenessInput }));
  return (
    <div className="h-64" role="img" aria-label="Tren SOP Completion dan SOP Awareness">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: "#d1d5db" }} />
          <YAxis tick={AXIS} tickFormatter={pctTick} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(1, Math.ceil(max * 10) / 10)]} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
          <Line dataKey="Completion" name="SOP Completion" stroke="var(--cat)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} connectNulls={false} />
          <Line dataKey="Awareness" name="SOP Awareness" stroke="var(--additional)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
