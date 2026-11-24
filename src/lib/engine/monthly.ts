// Monthly Achievement (docs/AUDIT_SPEC.md §2.7).
//   Jan–Sep: Total = 100% × SOP Completion
//   Oct–Dec: Total = 70% × SOP Completion + 30% × SOP Awareness
// Weights are stored per month so Administrators can change them. No capping at 100%.

import { finiteOrNull } from "./progress";
import type { MonthlyAchievement, MonthlyTarget } from "./types";

export const DEFAULT_MONTHLY_TARGETS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 0.9, 0.95, 1];

export function defaultWeights(month: number): { completion_weight: number; awareness_weight: number } {
  return month >= 10 ? { completion_weight: 0.7, awareness_weight: 0.3 } : { completion_weight: 1, awareness_weight: 0 };
}

export interface MonthlyRow {
  year: number;
  month: number;
  target: number | null;
  completionInput: number | null;
  awarenessInput: number | null;
  completionWeight: number;
  awarenessWeight: number;
  completionContribution: number;
  awarenessContribution: number;
  /** SUM(contributions) – blanks count as 0, exactly like the sheet */
  total: number;
  variance: number | null;
  hasInput: boolean;
}

export function checkMonthlyWeights(cw: number, aw: number): string | null {
  if (!Number.isFinite(cw) || !Number.isFinite(aw) || cw < 0 || aw < 0) return "Bobot tidak valid.";
  if (Math.abs(cw + aw - 1) > 1e-9) return `Total bobot ${(cw + aw) * 100}% (harus 100%).`;
  return null;
}

export function computeMonthly(
  year: number,
  targets: readonly MonthlyTarget[],
  achievements: readonly MonthlyAchievement[],
): MonthlyRow[] {
  const rows: MonthlyRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const t = targets.find((x) => x.year === year && x.month === month);
    const a = achievements.find((x) => x.year === year && x.month === month);
    const dw = defaultWeights(month);
    const cw = finiteOrNull(t?.completion_weight) ?? dw.completion_weight;
    const aw = finiteOrNull(t?.awareness_weight) ?? dw.awareness_weight;
    const completion = finiteOrNull(a?.sop_completion);
    const awareness = finiteOrNull(a?.sop_awareness);
    const completionContribution = cw * (completion ?? 0);
    const awarenessContribution = aw * (awareness ?? 0);
    const total = completionContribution + awarenessContribution;
    const target = finiteOrNull(t?.target);
    rows.push({
      year,
      month,
      target,
      completionInput: completion,
      awarenessInput: awareness,
      completionWeight: cw,
      awarenessWeight: aw,
      completionContribution,
      awarenessContribution,
      total,
      variance: target === null ? null : total - target,
      hasInput: completion !== null || awareness !== null,
    });
  }
  return rows;
}
