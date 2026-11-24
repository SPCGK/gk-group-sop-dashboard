import fixture from "./fixtures/spc-schedule-2027.json";
import { parseSpcGrid, sparseRowsToGrid, type Cell } from "@/lib/import/spc-parser";
import {
  DEFAULT_MONTHLY_TARGETS,
  DEFAULT_SETTINGS,
  defaultWeights,
  type EngineInput,
  type Holiday,
  type MonthlyAchievement,
  type MonthlyTarget,
  type Organization,
  type SopTask,
} from "@/lib/engine";

export const grid = sparseRowsToGrid(fixture.rows as Array<Record<string, Cell> & { r: number }>);
export const parsed = parseSpcGrid(grid);

export const NATIONAL_2027: Array<[string, string]> = [
  ["2027-01-01", "Tahun Baru 2027 Masehi"],
  ["2027-01-05", "Isra Mikraj Nabi Muhammad saw."],
  ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili"],
  ["2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)"],
  ["2027-03-10", "Idulfitri 1448 Hijriah"],
  ["2027-03-11", "Idulfitri 1448 Hijriah"],
  ["2027-03-26", "Wafat Yesus Kristus"],
  ["2027-03-28", "Hari Kebangkitan Yesus Kristus (Paskah)"],
  ["2027-05-01", "Hari Buruh Internasional"],
  ["2027-05-06", "Kenaikan Yesus Kristus"],
  ["2027-05-17", "Iduladha 1448 Hijriah"],
  ["2027-05-20", "Hari Raya Waisak 2571 BE"],
  ["2027-06-01", "Hari Lahir Pancasila"],
  ["2027-06-06", "1 Muharam Tahun Baru Islam 1449 Hijriah"],
  ["2027-08-15", "Maulid Nabi Muhammad SAW"],
  ["2027-08-17", "Proklamasi Kemerdekaan"],
  ["2027-12-25", "Kelahiran Yesus Kristus (Natal)"],
  ["2027-12-26", "Isra Mikraj Nabi Muhammad saw."],
];
export const JOINT_LEAVE_2027 = ["2027-02-05", "2027-03-09", "2027-03-12", "2027-03-15", "2027-03-25", "2027-05-18", "2027-05-19", "2027-12-24"];

export function holidays(opts: { jointLeaveExcluded?: boolean } = {}): Holiday[] {
  return [
    ...NATIONAL_2027.map(([d, n], i) => ({
      id: `n${i}`,
      holiday_date: d,
      holiday_name: n,
      category: "National Holiday" as const,
      description: null,
      exclude_from_working_days: true,
      source: "SKB 3 Menteri 2027",
    })),
    ...JOINT_LEAVE_2027.map((d, i) => ({
      id: `j${i}`,
      holiday_date: d,
      holiday_name: "Cuti Bersama",
      category: "Joint Leave" as const,
      description: null,
      exclude_from_working_days: !!opts.jointLeaveExcluded,
      source: "SKB 3 Menteri 2027",
    })),
  ];
}

export function orgsFromParse(): Organization[] {
  return parsed.organizations.map((o) => ({
    id: `org-${o.sort_order}`,
    organization_name: o.organization_name,
    organization_code: null,
    sort_order: o.sort_order,
    is_active: true,
  }));
}

export function tasksFromParse(): SopTask[] {
  return parsed.tasks.map((t) => ({
    id: `task-${t.source_row}`,
    task_number: t.task_number,
    task_seq: t.task_seq,
    organization_id: `org-${t.org_sort}`,
    sop_name: t.sop_name,
    task_type: t.task_type,
    document_classification: t.document_classification,
    workflow_status: t.workflow_status,
    critical: t.critical,
    start_date: t.start_date,
    end_date: t.end_date,
    actual_end_date: t.actual_end_date,
    progress_percentage: null,
    progress_source: "legacy",
    legacy_m: t.legacy_m,
    legacy_n: t.legacy_n,
    legacy_o: t.legacy_o,
    remark: t.remark,
    is_active: true,
    source_row: t.source_row,
  }));
}

export function monthlyFromParse(year = 2027): { targets: MonthlyTarget[]; achievements: MonthlyAchievement[] } {
  return {
    targets: parsed.monthly.map((m) => ({ year, month: m.month, target: m.target ?? DEFAULT_MONTHLY_TARGETS[m.month - 1], ...defaultWeights(m.month) })),
    achievements: parsed.monthly.map((m) => ({ year, month: m.month, sop_completion: m.sop_completion, sop_awareness: m.sop_awareness })),
  };
}

export function workbookInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const m = monthlyFromParse();
  return {
    organizations: orgsFromParse(),
    tasks: tasksFromParse(),
    holidays: holidays(),
    monthlyTargets: m.targets,
    monthlyAchievements: m.achievements,
    settings: DEFAULT_SETTINGS,
    today: "2026-11-24",
    ...overrides,
  };
}

export function newTask(partial: Partial<SopTask>): SopTask {
  return {
    id: partial.id ?? `t-${Math.random().toString(36).slice(2)}`,
    task_number: "99.1",
    task_seq: 1,
    organization_id: "org-1",
    sop_name: "SOP Test",
    task_type: "CAT",
    document_classification: "New",
    workflow_status: "Not Started",
    critical: false,
    start_date: null,
    end_date: null,
    actual_end_date: null,
    progress_percentage: 0,
    progress_source: "direct",
    legacy_m: null,
    legacy_n: null,
    legacy_o: null,
    remark: null,
    is_active: true,
    source_row: null,
    ...partial,
  };
}
