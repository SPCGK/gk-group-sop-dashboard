import type { EngineResult } from "@/lib/engine";
import { fmtPct } from "@/lib/engine";
import { ID_MONTHS_LONG } from "@/lib/engine/dates";
import { CompletionTrendChart, MonthlyTargetVsActualChart } from "./charts";
import { Card, CardHeader, cn } from "./ui";

export function MonthlyView({ result }: { result: EngineResult }) {
  const rows = result.monthly;
  const last = [...rows].reverse().find((r) => r.hasInput);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-ink-3">Bulan terakhir diinput</p>
          <p className="mt-2 text-2xl font-semibold">{last ? ID_MONTHS_LONG[last.month - 1] : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Target</p>
          <p className="mt-2 text-2xl font-semibold tabular">{last ? fmtPct(last.target, 0) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Total Achievement</p>
          <p className="mt-2 text-2xl font-semibold tabular">{last ? fmtPct(last.total, 0) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Variance</p>
          <p className={cn("mt-2 text-2xl font-semibold tabular", last?.variance !== null && last?.variance !== undefined && (last.variance >= 0 ? "text-ok" : "text-bad"))}>
            {last && last.variance !== null ? `${last.variance >= 0 ? "+" : ""}${fmtPct(last.variance, 0)}` : "—"}
          </p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Target vs Total Achievement" />
          <div className="px-2 py-3"><MonthlyTargetVsActualChart data={rows} /></div>
        </Card>
        <Card>
          <CardHeader title="Achievement Trend" description="Input SOP Completion & SOP Awareness" />
          <div className="px-2 py-3"><CompletionTrendChart data={rows} /></div>
        </Card>
      </div>
      <Card>
        <CardHeader
          title={`Monthly Achievement ${result.year}`}
          description="Jan–Sep: 100% × SOP Completion · Okt–Des: 70% × SOP Completion + 30% × SOP Awareness (bobot dapat diubah Admin). Total tidak dibatasi 100%."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-3">
              <tr>
                {["Bulan", "Target", "Bobot (C / A)", "SOP Completion", "SOP Awareness", "Actual Completion", "Actual Awareness", "Total Achievement", "Variance"].map((h, i) => (
                  <th key={h} className={cn("px-3 py-2.5 font-semibold first:pl-5", i > 0 && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular">
              {rows.map((r) => (
                <tr key={r.month} className={cn(!r.hasInput && "text-ink-3")}>
                  <td className="px-3 py-2 pl-5 font-medium text-ink">{ID_MONTHS_LONG[r.month - 1]}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(r.target, 0)}</td>
                  <td className="px-3 py-2 text-right text-xs">{Math.round(r.completionWeight * 100)}% / {Math.round(r.awarenessWeight * 100)}%</td>
                  <td className="px-3 py-2 text-right">{r.completionInput === null ? "—" : fmtPct(r.completionInput, 0)}</td>
                  <td className="px-3 py-2 text-right">{r.awarenessWeight === 0 ? <span className="text-xs">n/a</span> : r.awarenessInput === null ? "—" : fmtPct(r.awarenessInput, 0)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(r.completionContribution, 0)}</td>
                  <td className="px-3 py-2 text-right">{r.awarenessWeight === 0 ? "—" : fmtPct(r.awarenessContribution, 0)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-ink">{fmtPct(r.total, 0)}{!r.hasInput ? <span className="ml-1 text-[10px] font-normal text-ink-3">(belum diinput)</span> : null}</td>
                  <td className={cn("px-3 py-2 text-right font-medium", r.hasInput && r.variance !== null && (r.variance >= 0 ? "text-ok" : "text-bad"))}>
                    {r.variance === null ? "—" : `${r.variance >= 0 ? "+" : ""}${fmtPct(r.variance, 0)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
