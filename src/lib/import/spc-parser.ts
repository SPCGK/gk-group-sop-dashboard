// Parser for the 'SPC Schedule 2027' layout (docs/AUDIT_SPEC.md §1).
// Accepts a 2-D grid where grid[0] is sheet row 1 and grid[r][0] is column A.
// The grid may come from the Google Sheets API (UNFORMATTED_VALUE) or from a CSV export.

import { isValidIsoDate, sheetsSerialToIso } from "../engine/dates";
import { mean } from "../engine/progress";
import type { DocClass, TaskType, WorkflowStatus } from "../engine/types";

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];

const COL = { A: 0, B: 1, E: 4, F: 5, G: 6, H: 7, I: 8, K: 10, L: 11, M: 12, N: 13, O: 14, U: 20 } as const;

export type IssueLevel = "error" | "warning" | "info";
export interface ImportIssue {
  row: number;
  level: IssueLevel;
  message: string;
}

export interface ParsedOrganization {
  sort_order: number;
  organization_name: string;
  source_row: number;
}

export interface ParsedTask {
  source_row: number;
  org_sort: number;
  organization_name: string;
  task_seq: number;
  task_number: string;
  sop_name: string;
  task_type: TaskType | null;
  document_classification: DocClass | null;
  workflow_status: WorkflowStatus | null;
  critical: boolean;
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  legacy_m: number | null;
  legacy_n: number | null;
  legacy_o: number | null;
  remark: string | null;
  /** row-level validation result */
  valid: boolean;
}

export interface ParsedMonthly {
  month: number;
  target: number | null;
  sop_completion: number | null;
  sop_awareness: number | null;
}

export interface ParseResult {
  organizations: ParsedOrganization[];
  tasks: ParsedTask[];
  monthly: ParsedMonthly[];
  holidays: string[];
  issues: ImportIssue[];
  stats: { rowsScanned: number; tasksValid: number; tasksInvalid: number; skipped: number };
}

const str = (v: Cell): string => (v === null || v === undefined ? "" : String(v)).trim();

export function parseDateCell(v: Cell): { value: string | null; error: string | null } {
  if (v === null || v === undefined || v === "") return { value: null, error: null };
  if (typeof v === "number") {
    const iso = sheetsSerialToIso(v);
    return iso ? { value: iso, error: null } : { value: null, error: `Tanggal tidak valid: ${v}` };
  }
  const s = str(v);
  if (!s) return { value: null, error: null };
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.slice(0, 10);
    return isValidIsoDate(iso) ? { value: iso, error: null } : { value: null, error: `Tanggal tidak valid: ${s}` };
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // Indonesian locale: dd/mm/yyyy
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isValidIsoDate(iso) ? { value: iso, error: null } : { value: null, error: `Tanggal tidak valid: ${s}` };
  }
  if (/^\d+(\.\d+)?$/.test(s)) return parseDateCell(Number(s));
  return { value: null, error: `Format tanggal tidak dikenali: ${s}` };
}

/** Returns a fraction (0.5 = 50%). Accepts 0.5, "0,5", "50%", "50,00%". */
export function parseFractionCell(v: Cell): { value: number | null; error: string | null } {
  if (v === null || v === undefined || v === "") return { value: null, error: null };
  if (typeof v === "number") return Number.isFinite(v) ? { value: v, error: null } : { value: null, error: "Angka tidak valid" };
  if (typeof v === "boolean") return { value: null, error: `Nilai progres tidak valid: ${v}` };
  let s = str(v).replace(/\s/g, "");
  if (!s) return { value: null, error: null };
  const isPct = s.endsWith("%");
  if (isPct) s = s.slice(0, -1);
  // "1.234,56" → "1234.56"; "0,5" → "0.5"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { value: null, error: `Nilai progres tidak valid: ${v}` };
  const n = Number(s);
  const value = isPct ? n / 100 : n;
  if (value < 0 || value > 10) return { value: null, error: `Nilai progres di luar batas: ${v}` };
  return { value, error: null };
}

function parseBool(v: Cell): boolean {
  if (typeof v === "boolean") return v;
  const s = str(v).toUpperCase();
  return s === "TRUE" || s === "BENAR" || s === "YA" || s === "1" || s === "CRITICAL";
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseSpcGrid(grid: Grid): ParseResult {
  const issues: ImportIssue[] = [];
  const organizations: ParsedOrganization[] = [];
  const tasks: ParsedTask[] = [];
  let skipped = 0;
  const cell = (r: number, c: number): Cell => grid[r]?.[c];

  const headerIdx = grid.findIndex((row) => str(row?.[COL.A]).toLowerCase() === "task no");
  if (headerIdx < 0) {
    issues.push({ row: 0, level: "error", message: 'Header "Task No" tidak ditemukan. Pastikan sheet yang diekspor adalah "SPC Schedule 2027".' });
    return { organizations, tasks, monthly: [], holidays: [], issues, stats: { rowsScanned: 0, tasksValid: 0, tasksInvalid: 0, skipped: 0 } };
  }

  let current: ParsedOrganization | null = null;
  let r = headerIdx + 1;
  for (; r < grid.length; r++) {
    const rowNo = r + 1;
    if (str(cell(r, COL.L)) === "All") break; // summary block (row 78)
    const a = str(cell(r, COL.A));
    const b = str(cell(r, COL.B));
    if (!a) continue;

    if (/^\d+$/.test(a)) {
      if (!b) {
        issues.push({ row: rowNo, level: "info", message: `Baris nomor ${a} tanpa nama divisi dilewati.` });
        skipped++;
        continue;
      }
      if (organizations.some((o) => o.sort_order === Number(a))) {
        issues.push({ row: rowNo, level: "warning", message: `Nomor divisi ${a} duplikat – baris dilewati.` });
        skipped++;
        continue;
      }
      current = { sort_order: Number(a), organization_name: b, source_row: rowNo };
      organizations.push(current);
      continue;
    }

    const m = /^(\d+)\.(\d+)$/.exec(a);
    if (!m) continue; // legacy rows (#REF!), section titles, etc.

    const e = str(cell(r, COL.E));
    const f = str(cell(r, COL.F));
    const rawG = cell(r, COL.G);
    const hasData =
      e !== "" || f !== "" || rawG === true || str(rawG).toUpperCase() === "TRUE" ||
      [COL.H, COL.I, COL.K, COL.M, COL.N, COL.O, COL.U].some((c) => str(cell(r, c)) !== "");

    if (!b) {
      if (hasData) {
        issues.push({ row: rowNo, level: "warning", message: `Task ${a}: nama SOP kosong tetapi baris berisi data – dilewati.` });
        skipped++;
      }
      continue;
    }
    if (!current || String(current.sort_order) !== m[1]) {
      issues.push({ row: rowNo, level: "error", message: `Task ${a} tidak berada di bawah divisi nomor ${m[1]}.` });
      continue;
    }

    let valid = true;
    const rowErr = (msg: string) => {
      issues.push({ row: rowNo, level: "error", message: `Task ${a}: ${msg}` });
      valid = false;
    };
    const rowWarn = (msg: string) => issues.push({ row: rowNo, level: "warning", message: `Task ${a}: ${msg}` });

    let task_type: TaskType | null = null;
    if (e === "CAT" || e === "Additional") task_type = e;
    else if (e) rowErr(`kategori "${e}" tidak dikenal (harus CAT/Additional).`);
    else rowWarn("kategori CAT/Additional kosong – tidak dihitung di CAT maupun Additional.");

    let document_classification: DocClass | null = null;
    let hold = false;
    if (f === "New" || f === "Revision") document_classification = f;
    else if (f.toLowerCase() === "hold") hold = true;
    else if (f) rowErr(`New/Revision "${f}" tidak dikenal.`);

    const dates = [COL.H, COL.I, COL.K].map((c) => parseDateCell(cell(r, c)));
    dates.forEach((d) => d.error && rowErr(d.error));
    const [start, end, actual] = dates.map((d) => d.value);
    if ((start && !end) || (!start && end)) rowWarn("hanya salah satu dari Start/End Date yang terisi.");
    if (start && end && end < start) rowWarn("End Date lebih awal dari Start Date.");

    const fr = [COL.M, COL.N, COL.O].map((c) => parseFractionCell(cell(r, c)));
    fr.forEach((x) => x.error && rowErr(x.error));
    const [lm, ln, lo] = fr.map((x) => x.value);

    if (/^x+$/i.test(b)) rowWarn(`nama SOP "${b}" terlihat seperti placeholder – tetap dimigrasi agar perhitungan sama dengan sheet.`);
    if (start && start.slice(0, 4) !== "2027") rowWarn(`Start Date ${start} di luar periode 2027.`);

    const dup = tasks.find((t) => t.org_sort === current!.sort_order && normalizeName(t.sop_name) === normalizeName(b));
    if (dup) rowWarn(`nama SOP sama dengan baris ${dup.source_row}.`);

    let workflow_status: WorkflowStatus | null;
    if (hold) workflow_status = "Hold";
    else if (lo !== null) workflow_status = "Completed";
    else if (ln !== null) workflow_status = "In Progress";
    else if (lm !== null) workflow_status = "Not Started";
    else workflow_status = null;

    tasks.push({
      source_row: rowNo,
      org_sort: current.sort_order,
      organization_name: current.organization_name,
      task_seq: Number(m[2]),
      task_number: a,
      sop_name: b.replace(/\s+/g, " "),
      task_type,
      document_classification,
      workflow_status,
      critical: parseBool(rawG),
      start_date: start,
      end_date: end,
      actual_end_date: actual,
      legacy_m: lm,
      legacy_n: ln,
      legacy_o: lo,
      remark: str(cell(r, COL.U)) || null,
      valid,
    });
  }

  // Monthly table ("Bulan" / "Target") and Activity KPI inputs
  const monthly: ParsedMonthly[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, target: null, sop_completion: null, sop_awareness: null }));
  const bulanIdx = grid.findIndex((row) => str(row?.[COL.H]) === "Bulan" && str(row?.[COL.I]) === "Target");
  if (bulanIdx >= 0) {
    for (let i = 0; i < 12; i++) {
      const t = parseFractionCell(cell(bulanIdx + 1 + i, COL.I));
      monthly[i].target = t.value;
    }
  }
  const kpiIdx = grid.findIndex((row) => str(row?.[6]) === "Activity KPI");
  if (kpiIdx >= 0) {
    for (let k = 1; k <= 3; k++) {
      const label = str(cell(kpiIdx + k, 6)).toLowerCase();
      const key = label === "sop completion" ? "sop_completion" : label === "sop awareness" ? "sop_awareness" : null;
      if (!key) continue;
      for (let i = 0; i < 12; i++) {
        const v = parseFractionCell(cell(kpiIdx + k, 7 + i));
        if (v.error) issues.push({ row: kpiIdx + k + 1, level: "warning", message: `Activity KPI: ${v.error}` });
        monthly[i][key] = v.value;
      }
    }
  }

  // Holiday list in column G below the summary block, before "Activity KPI"
  const holidays: string[] = [];
  for (let i = r; i < (kpiIdx >= 0 ? kpiIdx : grid.length); i++) {
    const d = parseDateCell(cell(i, COL.G));
    if (d.value) holidays.push(d.value);
  }

  const tasksValid = tasks.filter((t) => t.valid).length;
  return {
    organizations,
    tasks,
    monthly,
    holidays,
    issues,
    stats: { rowsScanned: r - headerIdx - 1, tasksValid, tasksInvalid: tasks.length - tasksValid, skipped },
  };
}

/** Progress implied by legacy values – same rule as the engine (for preview). */
export function previewProgress(t: Pick<ParsedTask, "legacy_m" | "legacy_n" | "legacy_o">): number | null {
  return mean([t.legacy_m, t.legacy_n, t.legacy_o]);
}

/** Builds a grid from sparse {r, A, B, ...} rows (fixtures / tests). */
export function sparseRowsToGrid(rows: Array<Record<string, Cell> & { r: number }>): Grid {
  const grid: Grid = [];
  for (const row of rows) {
    const arr: Cell[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (k === "r") continue;
      const idx = k.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
      arr[idx] = v;
    }
    grid[row.r - 1] = arr;
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];
  return grid;
}
