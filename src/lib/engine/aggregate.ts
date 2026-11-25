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
  /** Σ SOP CAT / Additional yang dihitung (Not Started + In Progress + Completed; tanpa Hold & Not Input) */
  nCat: number;
  nAdditional: number;
  /** 1 (=100%) */
  catWeight: number;
  /** nAdditional ÷ (nCat + nAdditional), 0 bila tidak ada SOP */
  additionalWeight: number;
  catContribution: number | null;
  additionalContribution: number | null;
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

/**
 * Overall Achievement (workbook rows 78–82, rumus yang ditetapkan pengguna):
 *   bobot CAT        = 100%
 *   bobot Additional = Σ SOP Additional ÷ (Σ SOP CAT + Σ SOP Additional)      (Q81 = Q78/(P78+Q78))
 *   Overall          = %CAT × 100% + %Additional × bobot Additional          (R82)
 * Σ SOP = SOP aktif yang progresnya sudah diinput (Not Started + In Progress + Completed);
 * Hold dan "Not Input" tidak dihitung — sama dengan baris 78 workbook.
 * Bila tidak ada SOP Additional, bobot Additional = 0% dan hal itu ditampilkan (bukan diubah diam-diam).
 */
export function computeOverall(
  perf: readonly OrgPerformance[],
  summary: { cat: StatusCounts; additional: StatusCounts },
): OverallResult {
  const catVals = perf.map((p) => p.pctCat).filter((v): v is number => v !== null);
  const addVals = perf.map((p) => p.pctAdditional).filter((v): v is number => v !== null);
  const pctCat = mean(catVals);
  const pctAdditional = mean(addVals);
  const counted = (c: StatusCounts) => c.notStarted + c.inProgress + c.completed;
  const nCat = counted(summary.cat);
  const nAdditional = counted(summary.additional);
  const total = nCat + nAdditional;
  const catWeight = 1;
  const additionalWeight = total > 0 ? nAdditional / total : 0;

  let overallAchievement: number | null = null;
  let catContribution: number | null = null;
  let additionalContribution: number | null = null;
  let overallNote: string | null = null;
  if (pctCat === null && pctAdditional === null) {
    overallNote = "Belum ada data CAT maupun Additional.";
  } else {
    catContribution = (pctCat ?? 0) * catWeight;
    additionalContribution = (pctAdditional ?? 0) * additionalWeight;
    overallAchievement = catContribution + additionalContribution;
    if (!Number.isFinite(overallAchievement)) {
      overallAchievement = catContribution = additionalContribution = null;
      overallNote = "Perhitungan tidak valid.";
    } else if (pctCat === null) overallNote = "Data CAT belum tersedia (dihitung 0%).";
    else if (pctAdditional === null || nAdditional === 0) overallNote = "Tidak ada SOP Additional – bobot Additional 0%.";
  }
  return {
    pctCat,
    pctAdditional,
    overallAchievement,
    overallNote,
    orgsWithCat: catVals.length,
    orgsWithAdditional: addVals.length,
    nCat,
    nAdditional,
    catWeight,
    additionalWeight,
    catContribution,
    additionalContribution,
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
