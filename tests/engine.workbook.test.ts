// Compares the calculation engine with the values computed by the source workbook
// (docs/AUDIT_SPEC.md §3). Numbers here are copied from the sheet, not re-derived.

import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engine";
import { workbookInput } from "./helpers";

const r = runEngine(workbookInput());
const byName = (n: string) => r.organizations.find((o) => o.organization.organization_name === n)!;

describe("Workbook parity – division % CAT / % Additional (R14:S77)", () => {
  const expected: Record<string, [number | null, number | null]> = {
    Legal: [0.5, 0.3],
    GA: [null, null],
    Procurement: [0, null],
    ITM: [0.5 / 3, null],
    "R & A": [null, null],
    HC: [0, null],
    FAT: [0, null],
    Marcom: [null, null],
    Exrel: [0, null],
    SPM: [0, null],
    GBU: [null, 0.8],
    "Pilar Technology": [null, 0.3],
  };
  for (const [name, [cat, add]] of Object.entries(expected)) {
    it(`${name}`, () => {
      const o = byName(name);
      if (cat === null) expect(o.pctCat).toBeNull();
      else expect(o.pctCat).toBeCloseTo(cat, 10);
      if (add === null) expect(o.pctAdditional).toBeNull();
      else expect(o.pctAdditional).toBeCloseTo(add, 10);
    });
  }
});

describe("Workbook parity – overall (R78, S78, M81)", () => {
  it("Overall % CAT = 9.5238% (R78 / P82)", () => expect(r.overall.pctCat).toBeCloseTo(0.0952380952, 9));
  it("Overall % Additional = 46.6667% (S78)", () => expect(r.overall.pctAdditional).toBeCloseTo(0.4666666667, 9));
  it("Additional weight = 4 ÷ (17 + 4) = 19.05% (Q81)", () => {
    expect(r.overall.nCat).toBe(17);
    expect(r.overall.nAdditional).toBe(4);
    expect(r.overall.additionalWeight).toBeCloseTo(0.1904761905, 9);
  });
  it("Overall Achievement = 9.52% + 8.89% = 18.41% (R82)", () => {
    expect(r.overall.catContribution).toBeCloseTo(0.0952380952, 9);
    expect(r.overall.additionalContribution).toBeCloseTo(0.0888888889, 9);
    expect(r.overall.overallAchievement).toBeCloseTo(0.1841269841, 9);
  });
  it("averages over 7 CAT divisions and 3 Additional divisions", () => {
    expect(r.overall.orgsWithCat).toBe(7);
    expect(r.overall.orgsWithAdditional).toBe(3);
  });
});

describe("Workbook parity – status counts (M78:O80)", () => {
  it("All: Not Start 15, In Work 6, Complete 0", () => {
    expect(r.summary.all.notStarted).toBe(15);
    expect(r.summary.all.inProgress).toBe(6);
    expect(r.summary.all.completed).toBe(0);
  });
  it("CAT: 15 / 2 / 0", () => {
    expect([r.summary.cat.notStarted, r.summary.cat.inProgress, r.summary.cat.completed]).toEqual([15, 2, 0]);
  });
  it("Additional: 0 / 4 / 0", () => {
    expect([r.summary.additional.notStarted, r.summary.additional.inProgress, r.summary.additional.completed]).toEqual([0, 4, 0]);
  });
  it("SOPs without input are counted separately (SPM 4 + ITM 4.4)", () => expect(r.summary.all.notInput).toBe(5));
});

describe("Workbook parity – category counts per division (P, Q with D1–D3 corrected)", () => {
  it("totals", () => {
    expect(r.kpi.totalSop).toBe(26);
    expect(r.kpi.totalCat).toBe(21);
    expect(r.kpi.totalAdditional).toBe(4);
    expect(r.kpi.uncategorized).toBe(1);
  });
  it("Exrel counts its SOP CSR as CAT (sheet hard-codes P62 = 0 – D1)", () => {
    expect(byName("Exrel").cat).toBe(1);
    expect(byName("Exrel").additional).toBe(0);
  });
  it("FAT 7 CAT, HC 4 CAT, ITM 3 CAT + 1 uncategorized, GBU 2 Additional", () => {
    expect(byName("FAT").cat).toBe(7);
    expect(byName("HC").cat).toBe(4);
    expect(byName("ITM").cat).toBe(3);
    expect(byName("ITM").uncategorized).toBe(1);
    expect(byName("GBU").additional).toBe(2);
  });
});

describe("Workbook parity – Mandays (J) and Man Days (T)", () => {
  const t = (no: string) => r.tasks.find((x) => x.task_number === no)!;
  it("1.1 22/03–30/04/2027 → 28", () => expect(t("1.1").mandays).toBe(28));
  it("3.1 03/05–11/06/2027 → 25", () => expect(t("3.1").mandays).toBe(25));
  it("4.3 11/01–12/02/2027 → 24", () => expect(t("4.3").mandays).toBe(24));
  it("6.3 15/02–24/03/2027 → 24", () => expect(t("6.3").mandays).toBe(24));
  it("9.1 31/08–30/09/2026 → 22", () => expect(t("9.1").mandays).toBe(22));
  it("Man Days 4.3 (T29 references H32/I32) → 25", () => expect(t("4.3").man_days).toBe(25));
  it("missing dates → null instead of -1 (D6)", () => {
    expect(t("7.5").mandays).toBeNull();
    expect(t("1.1").actual_days).toBeNull();
  });
});

describe("Workbook parity – Monthly Achievement (H93:L104)", () => {
  const totals = r.monthly.map((m) => Math.round(m.total * 10000) / 100);
  it("Totals Jan..Dec = 20,0,0,0,0,0,0,0,0,49,94,111", () => {
    expect(totals).toEqual([20, 0, 0, 0, 0, 0, 0, 0, 0, 49, 94, 111]);
  });
  it("targets loaded from the sheet", () => {
    expect(r.monthly.map((m) => m.target)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 0.9, 0.95, 1]);
  });
  it("December 111% is not capped", () => expect(r.monthly[11].total).toBeCloseTo(1.11, 10));
});
