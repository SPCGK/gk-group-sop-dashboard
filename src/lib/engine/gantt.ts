// Gantt geometry (docs/AUDIT_SPEC.md §2.8). Pure functions so the chart, exports and tests agree.

import { addDays, isValidIsoDate, isWeekend, mondayOf, toDayNumber } from "./dates";
import type { SopProgress } from "./progress";
import type { SopTask } from "./types";

export type GanttScale = "day" | "week" | "month";

export const DAY_WIDTH: Record<GanttScale, number> = { day: 28, week: 9, month: 3.2 };

export interface TimelineDay {
  date: string;
  index: number;
  weekend: boolean;
  holidayName: string | null;
  isToday: boolean;
}

export function buildTimeline(
  start: string,
  end: string,
  holidays: ReadonlyMap<string, string>,
  today: string,
): TimelineDay[] {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return [];
  const from = mondayOf(start); // like V6: week starts Monday
  const span = Math.max(0, Math.min(1100, toDayNumber(end) - toDayNumber(from)));
  const days: TimelineDay[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    days.push({
      date,
      index: i,
      weekend: isWeekend(date),
      holidayName: holidays.get(date) ?? null,
      isToday: date === today,
    });
  }
  return days;
}

export interface BarGeometry {
  /** day offset from timeline start */
  offset: number;
  /** length in days, inclusive */
  length: number;
  /** progress fill in days: ROUNDDOWN((I-H+1) × progress) */
  progressDays: number;
  actualEndOffset: number | null;
  overdue: boolean;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export function barGeometry(
  task: Pick<SopTask, "start_date" | "end_date" | "actual_end_date">,
  progress: SopProgress,
  timelineStart: string,
  timelineLength: number,
  today: string,
): BarGeometry | null {
  if (!isValidIsoDate(task.start_date) || !isValidIsoDate(task.end_date)) return null;
  const t0 = toDayNumber(timelineStart);
  let s = toDayNumber(task.start_date) - t0;
  let e = toDayNumber(task.end_date) - t0;
  if (e < s) [s, e] = [e, s];
  const fullLength = e - s + 1;
  const frac = progress.value === null ? 0 : Math.max(0, Math.min(1, progress.value));
  const progressDaysFull = Math.floor(fullLength * frac);
  const clippedStart = s < 0;
  const clippedEnd = e > timelineLength - 1;
  const vs = Math.max(0, s);
  const ve = Math.min(timelineLength - 1, e);
  if (ve < vs) return null; // completely outside the window
  const progressEnd = s + progressDaysFull - 1;
  const progressDays = Math.max(0, Math.min(ve, progressEnd) - vs + 1);
  const actual = isValidIsoDate(task.actual_end_date) ? toDayNumber(task.actual_end_date) - t0 : null;
  const done = progress.status === "Completed" || progress.status === "Hold";
  const overdue = !done && !task.actual_end_date && task.end_date < today;
  return {
    offset: vs,
    length: ve - vs + 1,
    progressDays,
    actualEndOffset: actual !== null && actual >= 0 && actual < timelineLength ? actual : null,
    overdue,
    clippedStart,
    clippedEnd,
  };
}

export function isOverdue(
  task: Pick<SopTask, "end_date" | "actual_end_date">,
  progress: SopProgress,
  today: string,
): boolean {
  if (!isValidIsoDate(task.end_date)) return false;
  if (progress.status === "Completed" || progress.status === "Hold") return false;
  if (task.actual_end_date) return false;
  return task.end_date < today;
}
