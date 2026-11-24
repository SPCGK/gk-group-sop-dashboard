import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { parseDateCell, parseFractionCell, parseSpcGrid } from "@/lib/import/spc-parser";
import { grid, parsed, NATIONAL_2027 } from "./helpers";

describe("SPC Schedule 2027 parser (Sheets API grid)", () => {
  it("finds the 12 organizations in order", () => {
    expect(parsed.organizations.map((o) => o.organization_name)).toEqual([
      "Legal", "GA", "Procurement", "ITM", "R & A", "HC", "FAT", "Marcom", "Exrel", "SPM", "GBU", "Pilar Technology",
    ]);
  });
  it("imports 26 named SOPs, all valid", () => {
    expect(parsed.tasks).toHaveLength(26);
    expect(parsed.stats.tasksInvalid).toBe(0);
  });
  it("keeps raw M/N/O values", () => {
    const t = parsed.tasks.find((x) => x.task_number === "1.1")!;
    expect([t.legacy_m, t.legacy_n, t.legacy_o]).toEqual([null, 0.5, null]);
    expect(t.workflow_status).toBe("In Progress");
    expect(t.start_date).toBe("2027-03-22");
    expect(t.end_date).toBe("2027-04-30");
  });
  it("reports skipped rows without SOP name (2.2, 2.4, 5.1) and stray rows 76–77", () => {
    const skippedRows = parsed.issues.filter((i) => /nama SOP kosong/.test(i.message)).map((i) => i.row);
    expect(skippedRows).toEqual([21, 23, 37]);
    expect(parsed.issues.filter((i) => i.level === "info").map((i) => i.row)).toEqual([76, 77]);
  });
  it("warns for placeholder name and missing category", () => {
    expect(parsed.issues.some((i) => i.row === 16 && /placeholder/.test(i.message))).toBe(true);
    expect(parsed.issues.some((i) => i.row === 33 && /kategori/.test(i.message))).toBe(true);
  });
  it("reads holiday list G91:G108 = SKB 2027 national holidays", () => {
    expect(parsed.holidays).toEqual(NATIONAL_2027.map(([d]) => d));
  });
  it("reads monthly targets and Activity KPI inputs", () => {
    expect(parsed.monthly[0]).toEqual({ month: 1, target: 0.1, sop_completion: 0.2, sop_awareness: null });
    expect(parsed.monthly[11]).toEqual({ month: 12, target: 1, sop_completion: 1.2, sop_awareness: 0.9 });
  });
});

describe("CSV export path (Indonesian locale formatting)", () => {
  it("parses a CSV exported from Google Sheets the same way", () => {
    // Re-create the CSV a user would download: formatted dates dd/mm/yyyy and "50,00%".
    const fmt = (v: unknown, col: number) => {
      if (typeof v === "number" && [7, 8, 10].includes(col) && v > 40000) {
        const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
        return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      }
      if (typeof v === "number" && [12, 13, 14].includes(col)) return `${(v * 100).toFixed(2).replace(".", ",")}%`;
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return v ?? "";
    };
    const csv = Papa.unparse(grid.map((row) => Array.from({ length: 21 }, (_, c) => fmt(row[c], c))));
    const back = Papa.parse<string[]>(csv, { skipEmptyLines: false }).data;
    const res = parseSpcGrid(back);
    expect(res.tasks).toHaveLength(26);
    expect(res.tasks.map((t) => [t.task_number, t.start_date, t.legacy_m, t.legacy_n])).toEqual(
      parsed.tasks.map((t) => [t.task_number, t.start_date, t.legacy_m, t.legacy_n]),
    );
  });
  it("cell parsers", () => {
    expect(parseDateCell("22/03/2027").value).toBe("2027-03-22");
    expect(parseDateCell(46468).value).toBe("2027-03-22");
    expect(parseDateCell("31/02/2027").error).not.toBeNull();
    expect(parseFractionCell("50,00%").value).toBe(0.5);
    expect(parseFractionCell("0,3").value).toBe(0.3);
    expect(parseFractionCell("abc").error).not.toBeNull();
  });
  it("rejects a file without the SPC header", () => {
    const res = parseSpcGrid([["foo", "bar"]]);
    expect(res.issues[0].level).toBe("error");
  });
});
