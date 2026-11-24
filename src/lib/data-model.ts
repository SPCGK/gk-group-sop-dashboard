// Shapes returned by the Apps Script backend and their conversion into engine input.

import { DEFAULT_SETTINGS, todayJakarta, type EngineInput, type Holiday, type MonthlyAchievement, type MonthlyTarget, type Organization, type SopTask } from "./engine";
import { finiteOrNull } from "./engine/progress";

export interface ApiSettings {
  weights: { cat: number; additional: number };
  project: { start: string; end: string; name?: string };
  treat_uninput_as_zero: boolean;
  source?: { spreadsheet_id: string; sheet_name: string } | null;
}

export interface PublicData {
  organizations: Organization[];
  tasks: SopTask[];
  holidays: Holiday[];
  monthlyTargets: MonthlyTarget[];
  monthlyAchievements: MonthlyAchievement[];
  settings: ApiSettings;
  generatedAt: string;
}

export interface AdminRecord {
  email: string;
  name: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AdminData extends PublicData {
  admins: AdminRecord[];
  oauthClientId: string;
}

export interface AuditLog {
  id: string;
  created_at: string;
  user_email: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface HistoryRow {
  id: string;
  task_id: string;
  workflow_status: string | null;
  progress_percentage: number | null;
  progress_source: string | null;
  legacy_m: number | null;
  legacy_n: number | null;
  legacy_o: number | null;
  actual_end_date: string | null;
  changed_by_email: string | null;
  changed_at: string;
}

const date = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);

/** Defensive normalisation – the sheet is editable by its owner, so never trust types blindly. */
export function toEngineInput(d: PublicData, opts: { includeInactiveOrgs?: boolean; today?: string } = {}): EngineInput {
  const s = d.settings ?? (DEFAULT_SETTINGS as unknown as ApiSettings);
  return {
    organizations: (d.organizations ?? [])
      .filter((o) => opts.includeInactiveOrgs || o.is_active)
      .map((o) => ({ ...o, sort_order: Number(o.sort_order) || 0, is_active: !!o.is_active })),
    tasks: (d.tasks ?? []).map((t) => ({
      ...t,
      task_seq: Number(t.task_seq) || 0,
      critical: !!t.critical,
      is_active: !!t.is_active,
      start_date: date(t.start_date),
      end_date: date(t.end_date),
      actual_end_date: date(t.actual_end_date),
      progress_percentage: finiteOrNull(t.progress_percentage),
      progress_source: t.progress_source === "legacy" ? "legacy" : "direct",
      legacy_m: finiteOrNull(t.legacy_m),
      legacy_n: finiteOrNull(t.legacy_n),
      legacy_o: finiteOrNull(t.legacy_o),
    })),
    holidays: (d.holidays ?? []).map((h) => ({ ...h, holiday_date: date(h.holiday_date) ?? "", exclude_from_working_days: !!h.exclude_from_working_days })),
    monthlyTargets: (d.monthlyTargets ?? []).map((m) => ({
      ...m,
      year: Number(m.year),
      month: Number(m.month),
      target: Number(m.target),
      completion_weight: Number(m.completion_weight),
      awareness_weight: Number(m.awareness_weight),
    })),
    monthlyAchievements: (d.monthlyAchievements ?? []).map((m) => ({
      ...m,
      year: Number(m.year),
      month: Number(m.month),
      sop_completion: finiteOrNull(m.sop_completion),
      sop_awareness: finiteOrNull(m.sop_awareness),
    })),
    settings: {
      weights: { cat: Number(s.weights?.cat ?? 80), additional: Number(s.weights?.additional ?? 20) },
      project: { start: s.project?.start ?? "2027-01-01", end: s.project?.end ?? "2027-12-31" },
      treatUninputAsZero: s.treat_uninput_as_zero !== false,
    },
    today: opts.today ?? todayJakarta(),
  };
}
