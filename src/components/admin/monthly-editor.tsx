"use client";

import { useMemo, useState } from "react";
import type { MonthlyRow } from "@/lib/engine";
import { ID_MONTHS_LONG } from "@/lib/engine/dates";
import { cn } from "../ui";
import { ActionMessage, SubmitButton, useAction } from "./form-status";

const toPct = (v: number | null) => (v === null ? "" : String(Math.round(v * 10000) / 100));

export function MonthlyEditor({ year, rows }: { year: number; rows: MonthlyRow[] }) {
  const { state, pending, run } = useAction();
  const [vals, setVals] = useState(() =>
    rows.map((r) => ({ target: toPct(r.target), cw: toPct(r.completionWeight), completion: toPct(r.completionInput), awareness: toPct(r.awarenessInput) })),
  );
  const totals = useMemo(
    () =>
      vals.map((v) => {
        const cw = Number(v.cw || 0) / 100;
        const c = Number((v.completion || "0").replace(",", ".")) / 100;
        const a = Number((v.awareness || "0").replace(",", ".")) / 100;
        const total = cw * c + (1 - cw) * a;
        return Number.isFinite(total) ? total : null;
      }),
    [vals],
  );
  const e = state.errors ?? {};
  const set = (i: number, k: keyof (typeof vals)[number], v: string) => setVals((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const cell = "h-9 w-full rounded-md border border-line px-2 text-right text-sm tabular focus:outline-none focus:ring-2 focus:ring-brand/40";
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const pct = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")) / 100);
        run("saveMonthly", { year, rows: vals.map((v, i) => ({ month: i + 1, target: pct(v.target), completion_weight: pct(v.cw), sop_completion: pct(v.completion), sop_awareness: pct(v.awareness) })) });
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-3 py-2.5 pl-5 text-left font-semibold">Bulan</th>
              <th className="px-3 py-2.5 text-right font-semibold">Target (%)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Bobot Completion (%)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Bobot Awareness</th>
              <th className="px-3 py-2.5 text-right font-semibold">SOP Completion (%)</th>
              <th className="px-3 py-2.5 text-right font-semibold">SOP Awareness (%)</th>
              <th className="px-3 py-2.5 pr-5 text-right font-semibold">Total (preview)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vals.map((v, i) => {
              const m = i + 1;
              const cwNum = Number(v.cw || 0);
              return (
                <tr key={m}>
                  <td className="px-3 py-1.5 pl-5 font-medium">{ID_MONTHS_LONG[i]}</td>
                  <td className="px-3 py-1.5"><input name={`target_${m}`} value={v.target} onChange={(ev) => set(i, "target", ev.target.value)} inputMode="decimal" className={cn(cell, e[`target_${m}`] && "border-bad")} aria-label={`Target ${ID_MONTHS_LONG[i]}`} /></td>
                  <td className="px-3 py-1.5"><input name={`cw_${m}`} value={v.cw} onChange={(ev) => set(i, "cw", ev.target.value)} inputMode="decimal" className={cn(cell, e[`cw_${m}`] && "border-bad")} aria-label={`Bobot completion ${ID_MONTHS_LONG[i]}`} /></td>
                  <td className="px-3 py-1.5 text-right text-xs text-ink-3 tabular">{Number.isFinite(cwNum) ? `${Math.round((100 - cwNum) * 100) / 100}%` : "—"}</td>
                  <td className="px-3 py-1.5"><input name={`completion_${m}`} value={v.completion} onChange={(ev) => set(i, "completion", ev.target.value)} inputMode="decimal" placeholder="—" className={cn(cell, e[`completion_${m}`] && "border-bad")} aria-label={`SOP Completion ${ID_MONTHS_LONG[i]}`} /></td>
                  <td className="px-3 py-1.5"><input name={`awareness_${m}`} value={v.awareness} onChange={(ev) => set(i, "awareness", ev.target.value)} inputMode="decimal" placeholder="—" className={cn(cell, e[`awareness_${m}`] && "border-bad")} aria-label={`SOP Awareness ${ID_MONTHS_LONG[i]}`} /></td>
                  <td className="px-3 py-1.5 pr-5 text-right font-semibold tabular">{totals[i] === null ? "—" : `${(totals[i]! * 100).toFixed(1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
        <p className="text-xs text-ink-3">Default workbook: Jan–Sep bobot Completion 100%; Okt–Des 70% Completion + 30% Awareness. Kosongkan input bila belum ada data. Total tidak dibatasi 100%.</p>
        <div className="flex items-center gap-3">
          <ActionMessage state={state} />
          <SubmitButton pending={pending} variant="secondary">Simpan Monthly Achievement</SubmitButton>
        </div>
      </div>
    </form>
  );
}
