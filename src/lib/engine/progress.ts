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
