// Per-SOP progress (docs/AUDIT_SPEC.md §2.1).

import type { DerivedStatus, SopTask, WorkflowStatus } from "./types";

export function finiteOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Safe mean: ignores nulls, never returns NaN/Infinity. Empty → null. */
export function mean(values: readonly (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

export interface SopProgress {
  /** fraction 0..1 (legacy averages can exceed 1 if the sheet held such values); null = not input */
  value: number | null;
  status: DerivedStatus;
  /** true when Hold – excluded from achievement */
  excluded: boolean;
}

export function statusFromPercent(pct: number): Exclude<WorkflowStatus, "Hold"> {
  if (pct <= 0) return "Not Started";
  if (pct >= 100) return "Completed";
  return "In Progress";
}

type ProgressFields = Pick<
  SopTask,
  "workflow_status" | "progress_percentage" | "progress_source" | "legacy_m" | "legacy_n" | "legacy_o"
>;

export function sopProgress(task: ProgressFields): SopProgress {
  const hold = task.workflow_status === "Hold";

  if (task.progress_source === "legacy") {
    const m = finiteOrNull(task.legacy_m);
    const n = finiteOrNull(task.legacy_n);
    const o = finiteOrNull(task.legacy_o);
    // BYROW(M:O; IF(COUNTA(r)=0;;AVERAGE(r))) – average of the filled cells
    const value = mean([m, n, o]);
    let status: DerivedStatus;
    if (hold) status = "Hold";
    else if (o !== null) status = "Completed";
    else if (n !== null) status = "In Progress";
    else if (m !== null) status = "Not Started";
    else status = "Not Input";
    return { value, status, excluded: hold };
  }

  const pctRaw = finiteOrNull(task.progress_percentage);
  const pct = pctRaw === null ? null : Math.min(100, Math.max(0, pctRaw));
  const value = pct === null ? null : pct / 100;
  let status: DerivedStatus;
  if (hold) status = "Hold";
  else if (task.workflow_status) status = task.workflow_status;
  else status = pct === null ? "Not Input" : statusFromPercent(pct);
  return { value, status, excluded: hold };
}

/** Progress as an integer-ish percent for display (null-safe). */
export function progressPercent(p: SopProgress): number | null {
  return p.value === null ? null : p.value * 100;
}

/**
 * Validates the status/percentage pair entered by an Administrator.
 * Not Started = 0, In Progress = 1..99, Completed = 100, Hold = any 0..100.
 */
export function validateStatusProgress(status: WorkflowStatus, pct: number): string | null {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "Progress harus di antara 0–100%.";
  if (status === "Not Started" && pct !== 0) return "Status Not Started harus 0%.";
  if (status === "Completed" && pct !== 100) return "Status Completed harus 100%.";
  if (status === "In Progress" && (pct < 1 || pct > 99)) return "Status In Progress harus 1–99%.";
  return null;
}

/**
 * Tahapan progres SOP (ditetapkan pengguna 25-11-2026). Progres diinput per tahap, bukan angka bebas.
 * workflow_status yang disimpan tetap Not Started / In Progress / Completed sehingga hitungan
 * workbook (baris 78–80) dan Overall Achievement tidak berubah.
 */
export const PROGRESS_STAGES = [
  { key: "not_started", pct: 0, label: "Not Started", description: "Belum dimulai", status: "Not Started" },
  { key: "bpo_discussion", pct: 30, label: "BPO Discussion", description: "Diskusi dengan Business Process Owner", status: "In Progress" },
  { key: "drafting", pct: 50, label: "Drafting by SPC", description: "Penyusunan draf oleh SPC", status: "In Progress" },
  { key: "final_review", pct: 80, label: "Final Review (Pre-BOD)", description: "Finalisasi sebelum dipresentasikan ke BOD", status: "In Progress" },
  { key: "completed", pct: 100, label: "Completed", description: "Selesai", status: "Completed" },
] as const;

export type ProgressStage = (typeof PROGRESS_STAGES)[number];
export type StageKey = ProgressStage["key"] | "hold" | "not_input";

/** Stage of a SOP. In Progress values that are not exactly a stage fall to the highest stage reached. */
export function sopStage(p: Pick<SopProgress, "status" | "value">): StageKey {
  if (p.status === "Hold") return "hold";
  if (p.status === "Not Input") return "not_input";
  if (p.status === "Not Started") return "not_started";
  if (p.status === "Completed") return "completed";
  const pct = (p.value ?? 0) * 100;
  if (pct >= 80) return "final_review";
  if (pct >= 50) return "drafting";
  return "bpo_discussion";
}

/** The stage whose percentage equals the value exactly (used to preselect inputs), else null. */
export function exactStage(value: number | null): ProgressStage | null {
  if (value === null) return null;
  const pct = Math.round(value * 1000) / 10;
  return PROGRESS_STAGES.find((s) => s.pct === pct) ?? null;
}

export const STAGE_LABEL: Record<StageKey, string> = {
  not_started: PROGRESS_STAGES[0].label,
  bpo_discussion: PROGRESS_STAGES[1].label,
  drafting: PROGRESS_STAGES[2].label,
  final_review: PROGRESS_STAGES[3].label,
  completed: PROGRESS_STAGES[4].label,
  hold: "Hold",
  not_input: "Belum diinput",
};
