// Central working-day calculator. Reproduces Google Sheets NETWORKDAYS semantics:
//  * both endpoints inclusive
//  * Saturday & Sunday are non-working
//  * dates in the holiday set are non-working
//  * start > end returns a negative count
// See docs/AUDIT_SPEC.md §2.6.

import { isValidIsoDate, toDayNumber } from "./dates";
import type { Holiday } from "./types";

/** Guard against absurd ranges (e.g. a typo year 3027) – avoids long loops. */
const MAX_SPAN_DAYS = 3660;

export type HolidaySet = ReadonlySet<string>;

/** Only holidays flagged "Exclude from Working Days" reduce working days. */
export function buildHolidaySet(holidays: readonly Pick<Holiday, "holiday_date" | "exclude_from_working_days">[]): HolidaySet {
  const set = new Set<string>();
  for (const h of holidays) {
    if (h.exclude_from_working_days && isValidIsoDate(h.holiday_date)) set.add(h.holiday_date);
  }
  return set;
}

export const EMPTY_HOLIDAYS: HolidaySet = new Set<string>();

export function networkDays(start: string | null, end: string | null, holidays: HolidaySet = EMPTY_HOLIDAYS): number | null {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return null;
  let a = toDayNumber(start);
  let b = toDayNumber(end);
  let sign = 1;
  if (a > b) {
    [a, b] = [b, a];
    sign = -1;
  }
  if (b - a > MAX_SPAN_DAYS) return null;
  let count = 0;
  for (let d = a; d <= b; d++) {
    const dow = (((d + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday (4)
    if (dow === 0 || dow === 6) continue;
    if (holidays.size > 0 && holidays.has(new Date(d * 86_400_000).toISOString().slice(0, 10))) continue;
    count++;
  }
  return sign * count;
}

/** Column J – Mandays: NETWORKDAYS(Start; End; holidays) - 1. Null when a date is missing/invalid (D6). */
export function mandays(start: string | null, end: string | null, holidays: HolidaySet): number | null {
  const n = networkDays(start, end, holidays);
  return n === null ? null : n - 1;
}

/** Column L – Actual Days: NETWORKDAYS(Start; Actual End; holidays) - 1. */
export function actualDays(start: string | null, actualEnd: string | null, holidays: HolidaySet): number | null {
  const n = networkDays(start, actualEnd, holidays);
  return n === null ? null : n - 1;
}

/** Column T – Man Days: NETWORKDAYS(Start; End) without a holiday list, inclusive (D7). */
export function manDays(start: string | null, end: string | null): number | null {
  return networkDays(start, end, EMPTY_HOLIDAYS);
}

/** Conditional format on L: Actual Days ≤ Mandays → on time (green); otherwise late (red). */
export function isOnTime(actual: number | null, planned: number | null): boolean | null {
  if (actual === null || planned === null) return null;
  return actual <= planned;
}

/** True when the date is a working day (Mon–Fri and not in the holiday set). */
export function isWorkingDay(iso: string, holidays: HolidaySet = EMPTY_HOLIDAYS): boolean {
  if (!isValidIsoDate(iso)) return false;
  const d = toDayNumber(iso);
  const dow = (((d + 4) % 7) + 7) % 7;
  return dow !== 0 && dow !== 6 && !holidays.has(iso);
}

/**
 * Google Sheets WORKDAY(start; n; holidays): the n-th working day after `start` (n ≥ 0).
 * n = 0 returns `start` itself. End = workdayAdd(start, 25) gives Mandays (NETWORKDAYS − 1) = 25
 * when `start` is a working day.
 */
export function workdayAdd(start: string, n: number, holidays: HolidaySet = EMPTY_HOLIDAYS): string | null {
  if (!isValidIsoDate(start) || !Number.isInteger(n) || n < 0 || n > 2000) return null;
  let d = toDayNumber(start);
  let left = n;
  while (left > 0) {
    d++;
    if (isWorkingDay(new Date(d * 86_400_000).toISOString().slice(0, 10), holidays)) left--;
  }
  return new Date(d * 86_400_000).toISOString().slice(0, 10);
}

/** Holidays (non-working, Mon–Fri) that fall inside [start, end]. */
export function holidaysWithin(start: string | null, end: string | null, holidays: HolidaySet): string[] {
  if (!isValidIsoDate(start) || !isValidIsoDate(end) || start > end) return [];
  return [...holidays].filter((h) => h >= start && h <= end && isWorkingDay(h)).sort();
}
