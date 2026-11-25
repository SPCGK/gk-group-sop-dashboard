// Single entry point used by Dashboard, Master SOP, Division Performance, Monthly, Gantt and Export.

import { computeOrgPerformance, computeOverall, statusSummary, type OrgPerformance, type OverallResult } from "./aggregate";
import { computeMonthly, type MonthlyRow } from "./monthly";
import { sopProgress, sopStage, type SopProgress, type StageKey } from "./progress";
import { isOverdue } from "./gantt";
import { actualDays, buildHolidaySet, isOnTime, manDays, mandays } from "./workdays";
import type { EngineSettings, Holiday, MonthlyAchievement, MonthlyTarget, Organization, SopTask } from "./types";

export * from "./types";
export * from "./dates";
export * from "./workdays";
export * from "./progress";
export * from "./aggregate";
export * from "./monthly";
export * from "./gantt";

export interface EngineInput {
  organizations: Organization[];
  tasks: SopTask[];
  holidays: Holiday[];
  monthlyTargets: MonthlyTarget[];
  monthlyAchievements: MonthlyAchievement[];
  settings: EngineSettings;
  today: string;
}

export interface EnrichedTask extends SopTask {
  organization_name: string;
  organization_sort: number;
  progress: SopProgress;
  mandays: number | null;
  actual_days: number | null;
  man_days: number | null;
  on_time: boolean | null;
  overdue: boolean;
}

export interface EngineResult {
  tasks: EnrichedTask[];
  organizations: OrgPerformance[];
  overall: OverallResult;
  summary: ReturnType<typeof statusSummary>;
  kpi: {
    totalSop: number;
    totalCat: number;
    totalAdditional: number;
    uncategorized: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    notInput: number;
    hold: number;
    overdue: number;
  };
  /** Jumlah SOP aktif per tahap progres */
  stages: Record<StageKey, number>;
  monthly: MonthlyRow[];
  year: number;
}

function countStages(tasks: readonly { progress: SopProgress }[]): Record<StageKey, number> {
  const out: Record<StageKey, number> = { not_started: 0, bpo_discussion: 0, drafting: 0, final_review: 0, completed: 0, hold: 0, not_input: 0 };
  for (const t of tasks) out[sopStage(t.progress)]++;
  return out;
}

export function compareTaskNumber(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function runEngine(input: EngineInput): EngineResult {
  const holidaySet = buildHolidaySet(input.holidays);
  const orgById = new Map(input.organizations.map((o) => [o.id, o]));
  const activeTasks = input.tasks.filter((t) => t.is_active);

  const tasks: EnrichedTask[] = activeTasks
    .map((t) => {
      const progress = sopProgress(t);
      const md = mandays(t.start_date, t.end_date, holidaySet);
      const ad = actualDays(t.start_date, t.actual_end_date, holidaySet);
      const org = orgById.get(t.organization_id);
      return {
        ...t,
        organization_name: org?.organization_name ?? "(Organisasi tidak ditemukan)",
        organization_sort: org?.sort_order ?? 9999,
        progress,
        mandays: md,
        actual_days: ad,
        man_days: manDays(t.start_date, t.end_date),
        on_time: isOnTime(ad, md),
        overdue: isOverdue(t, progress, input.today),
      };
    })
    .sort((a, b) => a.organization_sort - b.organization_sort || compareTaskNumber(a.task_number, b.task_number));

  const organizations = computeOrgPerformance(input.organizations, activeTasks, input.settings);
  const summary = statusSummary(activeTasks);
  const overall = computeOverall(organizations, summary);
  const year = Number(input.settings.project.start.slice(0, 4)) || new Date().getFullYear();

  return {
    tasks,
    organizations,
    overall,
    summary,
    kpi: {
      totalSop: tasks.length,
      totalCat: tasks.filter((t) => t.task_type === "CAT").length,
      totalAdditional: tasks.filter((t) => t.task_type === "Additional").length,
      uncategorized: tasks.filter((t) => !t.task_type).length,
      completed: summary.all.completed,
      inProgress: summary.all.inProgress,
      notStarted: summary.all.notStarted,
      notInput: summary.all.notInput,
      hold: summary.all.hold,
      overdue: tasks.filter((t) => t.overdue).length,
    },
    stages: countStages(tasks),
    monthly: computeMonthly(year, input.monthlyTargets, input.monthlyAchievements),
    year,
  };
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return `${(v * 100).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
