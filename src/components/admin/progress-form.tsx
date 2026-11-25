"use client";

import { useState } from "react";
import { PROGRESS_STAGES, exactStage, type WorkflowStatus } from "@/lib/engine";
import { FieldError, Input, Label, Select } from "../ui";
import { ActionMessage, SubmitButton, useAction } from "./form-status";

/** Nilai select tahap: persentase tahap ("0", "30", …) atau "hold". "" = belum dipilih. */
export type StageChoice = "" | "hold" | `${(typeof PROGRESS_STAGES)[number]["pct"]}`;

export function initialStageChoice(status: WorkflowStatus | null, percent: number | null): StageChoice {
  if (status === "Hold") return "hold";
  if (status === null) return "";
  const s = exactStage(percent === null ? null : percent / 100);
  return s ? (String(s.pct) as StageChoice) : "";
}

/** Status & persentase yang disimpan untuk sebuah pilihan tahap. Hold mempertahankan persentase terakhir. */
export function stagePayload(choice: Exclude<StageChoice, "">, currentPercent: number | null): { workflow_status: WorkflowStatus; progress_percentage: number } {
  if (choice === "hold") return { workflow_status: "Hold", progress_percentage: Math.max(0, Math.min(100, Math.round(currentPercent ?? 0))) };
  const st = PROGRESS_STAGES.find((s) => String(s.pct) === choice)!;
  return { workflow_status: st.status, progress_percentage: st.pct };
}

export function StageOptions({ includeEmpty, emptyLabel }: { includeEmpty: boolean; emptyLabel: string }) {
  return (
    <>
      {includeEmpty ? <option value="" disabled>{emptyLabel}</option> : null}
      {PROGRESS_STAGES.map((s) => (
        <option key={s.pct} value={String(s.pct)}>{s.pct}% – {s.label}</option>
      ))}
      <option value="hold">Hold (ditunda)</option>
    </>
  );
}

export function ProgressForm({ id, status, percent, actualEnd, legacyNote }: { id: string; status: WorkflowStatus | null; percent: number | null; actualEnd: string | null; legacyNote?: string }) {
  const { state, pending, run } = useAction();
  const [choice, setChoice] = useState<StageChoice>(initialStageChoice(status, percent));
  const [actual, setActual] = useState(actualEnd ?? "");
  const e = state.errors ?? {};
  const offStage = status !== null && status !== "Hold" && choice === "" && percent !== null;
  const selected = PROGRESS_STAGES.find((s) => String(s.pct) === choice);
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!choice) return;
        run("updateProgress", { id, ...stagePayload(choice, percent), actual_end_date: actual });
      }}
    >
      {legacyNote ? <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-2">{legacyNote}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="stage">Tahap progres</Label>
          <Select id="stage" value={choice} onChange={(ev) => setChoice(ev.target.value as StageChoice)}>
            <StageOptions includeEmpty={choice === ""} emptyLabel={offStage ? `Progres saat ini ${Math.round(percent!)}% – pilih tahap` : "Belum diinput – pilih tahap"} />
          </Select>
          {selected ? <p className="mt-1 text-xs text-ink-3">{selected.description}.</p> : null}
          {choice === "hold" ? <p className="mt-1 text-xs text-warn">Hold dikecualikan dari pencapaian aktif; persentase terakhir ({Math.round(percent ?? 0)}%) tetap disimpan.</p> : null}
          <FieldError message={e.progress_percentage ?? e.workflow_status} />
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
