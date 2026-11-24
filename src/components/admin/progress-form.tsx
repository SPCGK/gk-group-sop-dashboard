"use client";

import { useState } from "react";
import type { WorkflowStatus } from "@/lib/engine";
import { FieldError, Input, Label, Select } from "../ui";
import { ActionMessage, SubmitButton, useAction } from "./form-status";

export function ProgressForm({ id, status, percent, actualEnd, legacyNote }: { id: string; status: WorkflowStatus | null; percent: number | null; actualEnd: string | null; legacyNote?: string }) {
  const { state, pending, run } = useAction();
  const [st, setSt] = useState<WorkflowStatus>(status ?? "Not Started");
  const [pct, setPct] = useState<number>(Math.round(percent ?? 0));
  const [actual, setActual] = useState(actualEnd ?? "");
  const onStatus = (v: WorkflowStatus) => {
    setSt(v);
    if (v === "Not Started") setPct(0);
    if (v === "Completed") setPct(100);
    if (v === "In Progress" && (pct <= 0 || pct >= 100)) setPct(50);
  };
  const onPct = (n: number) => {
    const v = Math.max(0, Math.min(100, Math.round(n)));
    setPct(v);
    if (st !== "Hold") setSt(v === 0 ? "Not Started" : v === 100 ? "Completed" : "In Progress");
  };
  const e = state.errors ?? {};
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        run("updateProgress", { id, workflow_status: st, progress_percentage: pct, actual_end_date: actual });
      }}
    >
      {legacyNote ? <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-2">{legacyNote}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="workflow_status">Status</Label>
          <Select id="workflow_status" value={st} onChange={(ev) => onStatus(ev.target.value as WorkflowStatus)}>
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Hold</option>
          </Select>
          {st === "Hold" ? <p className="mt-1 text-xs text-warn">Hold dikecualikan dari pencapaian aktif.</p> : null}
        </div>
        <div>
          <Label htmlFor="progress_percentage">Progress (%)</Label>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} value={pct} onChange={(ev) => onPct(Number(ev.target.value))} className="flex-1 accent-[var(--cat)]" aria-label="Progress slider" />
            <Input id="progress_percentage" type="number" min={0} max={100} value={pct} onChange={(ev) => onPct(Number(ev.target.value))} className="w-20 text-right" />
          </div>
          <FieldError message={e.progress_percentage} />
        </div>
        <div>
          <Label htmlFor="actual_end_date">Actual End Date</Label>
          <Input id="actual_end_date" type="date" value={actual} onChange={(ev) => setActual(ev.target.value)} />
          <FieldError message={e.actual_end_date} />
        </div>
      </div>
      <ActionMessage state={state} />
      <div className="flex justify-end"><SubmitButton pending={pending} variant="secondary">Simpan progres</SubmitButton></div>
    </form>
  );
}
