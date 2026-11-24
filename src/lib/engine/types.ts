// Shared domain types. Field names mirror the database columns (snake_case).

export const TASK_TYPES = ["CAT", "Additional"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const DOC_CLASSES = ["New", "Revision"] as const;
export type DocClass = (typeof DOC_CLASSES)[number];

export const WORKFLOW_STATUSES = ["Not Started", "In Progress", "Completed", "Hold"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

/** Status shown on screen. "Not Input" = progress has never been entered (legacy rows with empty M/N/O). */
export type DerivedStatus = WorkflowStatus | "Not Input";

export const HOLIDAY_CATEGORIES = [
  "National Holiday",
  "Joint Leave",
  "Company Holiday",
  "Other Holiday",
] as const;
export type HolidayCategory = (typeof HOLIDAY_CATEGORIES)[number];

export type ProgressSource = "legacy" | "direct";

export interface Organization {
  id: string;
  organization_name: string;
  organization_code: string | null;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SopTask {
  id: string;
  task_number: string;
  task_seq: number;
  organization_id: string;
  sop_name: string;
  task_type: TaskType | null;
  document_classification: DocClass | null;
  workflow_status: WorkflowStatus | null;
  critical: boolean;
  /** ISO date yyyy-mm-dd */
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  /** 0..100, used when progress_source = 'direct' */
  progress_percentage: number | null;
  progress_source: ProgressSource;
  /** Raw workbook values (fractions, e.g. 0.5) from columns M / N / O */
  legacy_m: number | null;
  legacy_n: number | null;
  legacy_o: number | null;
  remark: string | null;
  is_active: boolean;
  source_row: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  category: HolidayCategory;
  description: string | null;
  exclude_from_working_days: boolean;
  source: string | null;
}

export interface MonthlyTarget {
  id?: string;
  year: number;
  month: number; // 1..12
  target: number; // fraction
  completion_weight: number; // fraction
  awareness_weight: number; // fraction
}

export interface MonthlyAchievement {
  id?: string;
  year: number;
  month: number;
  sop_completion: number | null; // fraction
  sop_awareness: number | null; // fraction
  notes?: string | null;
}

export interface EngineSettings {
  /** percent, must sum to 100 */
  weights: { cat: number; additional: number };
  project: { start: string; end: string };
  /** Source behaviour: SOPs without progress input count as 0 in division averages. */
  treatUninputAsZero: boolean;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  weights: { cat: 80, additional: 20 },
  project: { start: "2027-01-01", end: "2027-12-31" },
  treatUninputAsZero: true,
};
