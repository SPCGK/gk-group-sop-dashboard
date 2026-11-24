// Division & overall aggregation (docs/AUDIT_SPEC.md §2.2–2.5).

import { mean, sopProgress, type SopProgress } from "./progress";
import type { DerivedStatus, EngineSettings, Organization, SopTask, TaskType } from "./types";

export interface StatusCounts {
  notStarted: number;
  inProgress: number;
  completed: number;
  hold: number;
  notInput: number;
}

export interface OrgPerformance {
  organization: Organization;
  totalSop: number;
  cat: number;
  additional: number;
  uncategorized: number;
  counts: StatusCounts;
  /** fraction or null (N/A) */
  pctCat: number | null;
  pctAdditional: number | null;
}

export interface WeightCheck {
  valid: boolean;
  message: string | null;
}

export function checkWeights(w: EngineSettings["weights"]): WeightCheck {
  const c = Number(w?.cat);
  const a = Number(w?.additional);
  if (!Number.isFinite(c) || !Number.isFinite(a)) return { valid: false, message: "Bobot tidak valid." };
  if (c < 0 || a < 0 || c > 100 || a > 100) return { valid: false, message: "Bobot harus 0–100%." };
  if (Math.abs(c + a - 100) > 1e-9) return { valid: false, message: `Total bobot ${c + a}% (harus 100%).` };
  return { valid: true, message: null };
}

export interface OverallResult {
  pctCat: number | null;
  pctAdditional: number | null;
  overallAchievement: number | null;
  /** Why overall is N/A, if it is */
  overallNote: string | null;
  orgsWithCat: number;
  orgsWithAdditional: number;
}

function emptyCounts(): StatusCounts {
  return { notStarted: 0, inProgress: 0, completed: 0, hold: 0, notInput: 0 };
}

export function addToCounts(c: StatusCounts, s: DerivedStatus) {
  if (s === "Not Started") c.notStarted++;
  else if (s === "In Progress") c.inProgress++;
  else if (s === "Completed") c.completed++;
  else if (s === "Hold") c.hold++;
  else c.notInput++;
}

/** AVERAGE(FILTER(progressRow; division; E = type; F <> "Hold")) */
export function categoryAverage(
  items: readonly { task: Pick<SopTask, "task_type">; progress: SopProgress }[],
  type: TaskType,
  treatUninputAsZero: boolean,
): number | null {
  const vals: number[] = [];
  for (const { task, progress } of items) {
    if (task.task_type !== type || progress.excluded) continue;
    if (progress.value === null) {
      if (treatUninputAsZero) vals.push(0);
      continue;
    }
    vals.push(progress.value);
  }
  return mean(vals);
}

export function computeOrgPerformance(
  orgs: readonly Organization[],
  tasks: readonly SopTask[],
  settings: EngineSettings,
): OrgPerformance[] {
  const active = tasks.filter((t) => t.is_active);
  const byOrg = new Map<string, { task: SopTask; progress: SopProgress }[]>();
  for (const t of active) {
    const list = byOrg.get(t.organization_id) ?? [];
    list.push({ task: t, progress: sopProgress(t) });
    byOrg.set(t.organization_id, list);
  }
  return [...orgs]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((org) => {
      const items = byOrg.get(org.id) ?? [];
      const counts = emptyCounts();
      let cat = 0;
      let additional = 0;
      let uncategorized = 0;
      for (const { task, progress } of items) {
        addToCounts(counts, progress.status);
        if (task.task_type === "CAT") cat++;
        else if (task.task_type === "Additional") additional++;
        else uncategorized++;
      }
      return {
        organization: org,
        totalSop: items.length,
        cat,
        additional,
        uncategorized,
        counts,
        pctCat: categoryAverage(items, "CAT", settings.treatUninputAsZero),
        pctAdditional: categoryAverage(items, "Additional", settings.treatUninputAsZero),
      };
    });
}

export function computeOverall(perf: readonly OrgPerformance[], settings: EngineSettings): OverallResult {
  const catVals = perf.map((p) => p.pctCat).filter((v): v is number => v !== null);
  const addVals = perf.map((p) => p.pctAdditional).filter((v): v is number => v !== null);
  const pctCat = mean(catVals);
  const pctAdditional = mean(addVals);
  const wc = checkWeights(settings.weights);
  let overallAchievement: number | null = null;
  let overallNote: string | null = null;
  if (!wc.valid) overallNote = wc.message;
  else if (pctCat === null && pctAdditional === null) overallNote = "Belum ada data CAT maupun Additional.";
  else if (pctCat === null) overallNote = "Data CAT belum tersedia.";
  else if (pctAdditional === null) overallNote = "Data Additional belum tersedia.";
  else
    overallAchievement =
      (pctCat * settings.weights.cat) / 100 + (pctAdditional * settings.weights.additional) / 100;
  return {
    pctCat,
    pctAdditional,
    overallAchievement,
    overallNote,
    orgsWithCat: catVals.length,
    orgsWithAdditional: addVals.length,
  };
}

/** Summary rows 78–80: status counts excluding Hold, optionally by category. */
export function statusSummary(tasks: readonly SopTask[]) {
  const all = emptyCounts();
  const cat = emptyCounts();
  const additional = emptyCounts();
  for (const t of tasks) {
    if (!t.is_active) continue;
    const p = sopProgress(t);
    addToCounts(all, p.status);
    if (t.task_type === "CAT") addToCounts(cat, p.status);
    else if (t.task_type === "Additional") addToCounts(additional, p.status);
  }
  return { all, cat, additional };
}
