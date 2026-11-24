// Report definitions. Every report is built ONLY from the calculation engine result, so the
// numbers in Excel / CSV / PDF are identical to what the dashboard shows.

import { formatDateId, monthShortId, ID_MONTHS_LONG } from "../engine/dates";
import type { EngineResult } from "../engine";
import type { Holiday } from "../engine/types";

export const REPORT_TYPES = {
  "sop-master": "SOP Master List",
  "division-progress": "SOP Progress by Division",
  "cat-achievement": "CAT Achievement",
  "additional-achievement": "Additional Achievement",
  "overall-achievement": "Overall Achievement",
  "monthly-achievement": "Monthly Achievement",
  gantt: "Gantt Chart",
  holidays: "Holiday List",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;

export type CellValue = string | number | null;
export interface ReportColumn {
  key: string;
  header: string;
  /** 'pct' values are fractions; 'int' plain numbers; 'text' strings; 'date' ISO strings */
  kind: "text" | "pct" | "int" | "date";
  width?: number;
}
export interface Report {
  type: ReportType;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, CellValue>[];
  notes: string[];
}

const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? null : v);

export function buildReport(type: ReportType, r: EngineResult, holidays: Holiday[], weights: { cat: number; additional: number }): Report {
  const title = REPORT_TYPES[type];
  switch (type) {
    case "sop-master":
      return {
        type,
        title,
        notes: [],
        columns: [
          { key: "task_number", header: "Task No", kind: "text", width: 8 },
          { key: "organization", header: "Organization", kind: "text", width: 18 },
          { key: "sop_name", header: "SOP Name", kind: "text", width: 45 },
          { key: "category", header: "Category", kind: "text", width: 11 },
          { key: "classification", header: "New/Revision", kind: "text", width: 11 },
          { key: "critical", header: "Critical", kind: "text", width: 9 },
          { key: "start_date", header: "Start Date", kind: "date", width: 12 },
          { key: "end_date", header: "End Date", kind: "date", width: 12 },
          { key: "mandays", header: "Mandays", kind: "int", width: 9 },
          { key: "actual_end_date", header: "Actual End Date", kind: "date", width: 13 },
          { key: "actual_days", header: "Actual Days", kind: "int", width: 10 },
          { key: "man_days", header: "Man Days", kind: "int", width: 9 },
          { key: "progress", header: "Progress", kind: "pct", width: 10 },
          { key: "status", header: "Status", kind: "text", width: 12 },
          { key: "remark", header: "Remark", kind: "text", width: 30 },
        ],
        rows: r.tasks.map((t) => ({
          task_number: t.task_number,
          organization: t.organization_name,
          sop_name: t.sop_name,
          category: t.task_type ?? "-",
          classification: t.document_classification ?? "-",
          critical: t.critical ? "Critical" : "Non-Critical",
          start_date: t.start_date,
          end_date: t.end_date,
          mandays: t.mandays,
          actual_end_date: t.actual_end_date,
          actual_days: t.actual_days,
          man_days: t.man_days,
          progress: pct(t.progress.value),
          status: t.progress.status === "Not Input" ? "Belum diinput" : t.progress.status,
          remark: t.remark,
        })),
      };
    case "division-progress":
      return {
        type,
        title,
        notes: ["N/A = divisi tidak memiliki SOP pada kategori tersebut."],
        columns: [
          { key: "organization", header: "Organization", kind: "text", width: 20 },
          { key: "total", header: "Total SOP", kind: "int" },
          { key: "cat", header: "CAT", kind: "int" },
          { key: "additional", header: "Additional", kind: "int" },
          { key: "not_started", header: "Not Started", kind: "int" },
          { key: "not_input", header: "Belum diinput", kind: "int" },
          { key: "in_progress", header: "In Progress", kind: "int" },
          { key: "completed", header: "Completed", kind: "int" },
          { key: "hold", header: "Hold", kind: "int" },
          { key: "pct_cat", header: "% CAT", kind: "pct" },
          { key: "pct_additional", header: "% Additional", kind: "pct" },
        ],
        rows: r.organizations.map((o) => ({
          organization: o.organization.organization_name,
          total: o.totalSop,
          cat: o.cat,
          additional: o.additional,
          not_started: o.counts.notStarted,
          not_input: o.counts.notInput,
          in_progress: o.counts.inProgress,
          completed: o.counts.completed,
          hold: o.counts.hold,
          pct_cat: pct(o.pctCat),
          pct_additional: pct(o.pctAdditional),
        })),
      };
    case "cat-achievement":
    case "additional-achievement": {
      const isCat = type === "cat-achievement";
      const rows = r.organizations
        .filter((o) => (isCat ? o.pctCat : o.pctAdditional) !== null)
        .map((o) => ({
          organization: o.organization.organization_name,
          sop_count: isCat ? o.cat : o.additional,
          achievement: pct(isCat ? o.pctCat : o.pctAdditional),
        }));
      rows.push({
        organization: `Overall % ${isCat ? "CAT" : "Additional"}`,
        sop_count: isCat ? r.kpi.totalCat : r.kpi.totalAdditional,
        achievement: pct(isCat ? r.overall.pctCat : r.overall.pctAdditional),
      });
      return {
        type,
        title,
        notes: ["Overall = rata-rata persentase divisi yang memiliki data pada kategori ini (Hold dikecualikan)."],
        columns: [
          { key: "organization", header: "Organization", kind: "text", width: 26 },
          { key: "sop_count", header: isCat ? "Jumlah SOP CAT" : "Jumlah SOP Additional", kind: "int" },
          { key: "achievement", header: isCat ? "% CAT" : "% Additional", kind: "pct" },
        ],
        rows,
      };
    }
    case "overall-achievement":
      return {
        type,
        title,
        notes: r.overall.overallNote ? [r.overall.overallNote] : [`Overall Achievement = (% CAT × ${weights.cat}%) + (% Additional × ${weights.additional}%)`],
        columns: [
          { key: "metric", header: "Metric", kind: "text", width: 30 },
          { key: "weight", header: "Bobot", kind: "pct" },
          { key: "value", header: "Nilai", kind: "pct" },
          { key: "contribution", header: "Kontribusi", kind: "pct" },
        ],
        rows: [
          {
            metric: "Overall % CAT",
            weight: weights.cat / 100,
            value: pct(r.overall.pctCat),
            contribution: r.overall.pctCat === null ? null : (r.overall.pctCat * weights.cat) / 100,
          },
          {
            metric: "Overall % Additional",
            weight: weights.additional / 100,
            value: pct(r.overall.pctAdditional),
            contribution: r.overall.pctAdditional === null ? null : (r.overall.pctAdditional * weights.additional) / 100,
          },
          { metric: "Overall Achievement", weight: 1, value: pct(r.overall.overallAchievement), contribution: pct(r.overall.overallAchievement) },
        ],
      };
    case "monthly-achievement":
      return {
        type,
        title,
        notes: ["Total tidak dibatasi 100%. Input kosong dihitung 0 (sesuai workbook)."],
        columns: [
          { key: "month", header: "Bulan", kind: "text", width: 12 },
          { key: "target", header: "Target", kind: "pct" },
          { key: "completion_input", header: "SOP Completion (input)", kind: "pct" },
          { key: "awareness_input", header: "SOP Awareness (input)", kind: "pct" },
          { key: "completion", header: "Actual Completion", kind: "pct" },
          { key: "awareness", header: "Actual Awareness", kind: "pct" },
          { key: "total", header: "Total Achievement", kind: "pct" },
          { key: "variance", header: "Variance", kind: "pct" },
        ],
        rows: r.monthly.map((m) => ({
          month: ID_MONTHS_LONG[m.month - 1],
          target: m.target,
          completion_input: m.completionInput,
          awareness_input: m.awarenessInput,
          completion: m.completionContribution,
          awareness: m.awarenessContribution,
          total: m.total,
          variance: m.variance,
        })),
      };
    case "gantt":
      return {
        type,
        title,
        notes: ["Progress fill pada Gantt = ROUNDDOWN((End − Start + 1) × Progress) hari kalender."],
        columns: [
          { key: "task_number", header: "Task No", kind: "text", width: 8 },
          { key: "organization", header: "Organization", kind: "text", width: 18 },
          { key: "sop_name", header: "SOP Name", kind: "text", width: 40 },
          { key: "start_date", header: "Start", kind: "date", width: 12 },
          { key: "end_date", header: "End", kind: "date", width: 12 },
          { key: "actual_end_date", header: "Actual End", kind: "date", width: 12 },
          { key: "mandays", header: "Mandays", kind: "int" },
          { key: "progress", header: "Progress", kind: "pct" },
          { key: "critical", header: "Critical", kind: "text" },
          { key: "flag", header: "Flag", kind: "text", width: 14 },
        ],
        rows: r.tasks.map((t) => ({
          task_number: t.task_number,
          organization: t.organization_name,
          sop_name: t.sop_name,
          start_date: t.start_date,
          end_date: t.end_date,
          actual_end_date: t.actual_end_date,
          mandays: t.mandays,
          progress: pct(t.progress.value),
          critical: t.critical ? "Ya" : "",
          flag: !t.start_date || !t.end_date ? "Tanpa jadwal" : t.overdue ? "Overdue" : t.on_time === false ? "Terlambat" : "",
        })),
      };
    case "holidays":
      return {
        type,
        title,
        notes: [],
        columns: [
          { key: "date", header: "Tanggal", kind: "date", width: 13 },
          { key: "name", header: "Nama Hari Libur", kind: "text", width: 40 },
          { key: "category", header: "Kategori", kind: "text", width: 16 },
          { key: "exclude", header: "Exclude from Working Days", kind: "text", width: 14 },
          { key: "source", header: "Sumber", kind: "text", width: 30 },
        ],
        rows: [...holidays]
          .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
          .map((h) => ({ date: h.holiday_date, name: h.holiday_name, category: h.category, exclude: h.exclude_from_working_days ? "Ya" : "Tidak", source: h.source })),
      };
  }
}

export function formatCell(v: CellValue, kind: ReportColumn["kind"]): string {
  if (v === null || v === undefined || v === "") return kind === "pct" ? "N/A" : "";
  if (kind === "pct" && typeof v === "number") return `${(v * 100).toFixed(2)}%`;
  if (kind === "date" && typeof v === "string") return formatDateId(v);
  return String(v);
}

export function toCsv(rep: Report): string {
  const esc = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [rep.columns.map((c) => esc(c.kind === "pct" ? `${c.header} (%)` : c.header)).join(",")];
  for (const row of rep.rows) {
    lines.push(
      rep.columns
        .map((c) => {
          const v = row[c.key];
          if (v === null || v === undefined) return "";
          if (c.kind === "pct" && typeof v === "number") return (v * 100).toFixed(4);
          return esc(String(v));
        })
        .join(","),
    );
  }
  return "﻿" + lines.join("\n");
}

export { monthShortId };
