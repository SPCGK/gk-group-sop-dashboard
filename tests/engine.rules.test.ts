// Business rules & edge cases (requirement §18 scenarios).

import { describe, expect, it } from "vitest";
import {
  actualDays,
  barGeometry,
  buildHolidaySet,
  computeMonthly,
  DEFAULT_SETTINGS,
  manDays,
  mandays,
  networkDays,
  runEngine,
  sopProgress,
  validateStatusProgress,
  type Organization,
} from "@/lib/engine";
import { buildReport, toCsv } from "@/lib/export/reports";
import { findDuplicateSop, sopInputSchema, progressInputSchema, weightsSchema } from "@/lib/validation";
import { holidays, newTask, workbookInput } from "./helpers";

const ORG: Organization = { id: "org-1", organization_name: "Legal", organization_code: "LGL", sort_order: 1, is_active: true };
const base = (tasks = [] as ReturnType<typeof newTask>[]) =>
  workbookInput({ organizations: [ORG], tasks });

describe("1–3. CAT, Additional, Overall", () => {
  it("CAT progress = average of CAT SOPs", () => {
    const r = runEngine(base([newTask({ progress_percentage: 50, workflow_status: "In Progress" }), newTask({ progress_percentage: 100, workflow_status: "Completed" })]));
    expect(r.organizations[0].pctCat).toBeCloseTo(0.75);
  });
  it("Additional progress = average of Additional SOPs", () => {
    const r = runEngine(base([newTask({ task_type: "Additional", progress_percentage: 20, workflow_status: "In Progress" })]));
    expect(r.organizations[0].pctAdditional).toBeCloseTo(0.2);
  });
  it("Overall = CAT×80% + Additional×20%", () => {
    const r = runEngine(
      base([
        newTask({ progress_percentage: 50, workflow_status: "In Progress" }),
        newTask({ task_type: "Additional", progress_percentage: 100, workflow_status: "Completed" }),
      ]),
    );
    expect(r.overall.overallAchievement).toBeCloseTo(0.5 * 0.8 + 1 * 0.2);
  });
  it("custom weights 70/30 are applied", () => {
    const input = base([newTask({ progress_percentage: 50, workflow_status: "In Progress" }), newTask({ task_type: "Additional", progress_percentage: 100, workflow_status: "Completed" })]);
    const r = runEngine({ ...input, settings: { ...DEFAULT_SETTINGS, weights: { cat: 70, additional: 30 } } });
    expect(r.overall.overallAchievement).toBeCloseTo(0.65);
  });
  it("weights not summing to 100 → N/A, never silently re-weighted", () => {
    const input = base([newTask({ progress_percentage: 50, workflow_status: "In Progress" }), newTask({ task_type: "Additional", progress_percentage: 100, workflow_status: "Completed" })]);
    const r = runEngine({ ...input, settings: { ...DEFAULT_SETTINGS, weights: { cat: 80, additional: 30 } } });
    expect(r.overall.overallAchievement).toBeNull();
    expect(r.overall.overallNote).toMatch(/100%/);
  });
  it("one category without data → Overall N/A (not 100% of the other)", () => {
    const r = runEngine(base([newTask({ progress_percentage: 50, workflow_status: "In Progress" })]));
    expect(r.overall.pctCat).toBeCloseTo(0.5);
    expect(r.overall.overallAchievement).toBeNull();
    expect(r.overall.overallNote).toMatch(/Additional/);
  });
});

describe("4. Hold exclusion", () => {
  it("Hold SOP is excluded from % but still counted", () => {
    const r = runEngine(
      base([
        newTask({ progress_percentage: 100, workflow_status: "Completed" }),
        newTask({ progress_percentage: 0, workflow_status: "Hold" }),
      ]),
    );
    expect(r.organizations[0].pctCat).toBe(1);
    expect(r.organizations[0].counts.hold).toBe(1);
    expect(r.organizations[0].cat).toBe(2);
  });
  it("legacy Hold (F = Hold) keeps M/N/O values but is excluded", () => {
    const p = sopProgress({ workflow_status: "Hold", progress_source: "legacy", progress_percentage: null, legacy_m: null, legacy_n: 0.4, legacy_o: null });
    expect(p.excluded).toBe(true);
    expect(p.value).toBeCloseTo(0.4);
    expect(p.status).toBe("Hold");
  });
  it("division with only Hold SOPs → N/A", () => {
    const r = runEngine(base([newTask({ workflow_status: "Hold" })]));
    expect(r.organizations[0].pctCat).toBeNull();
  });
});

describe("5. Empty data", () => {
  it("no organizations & no tasks → no NaN/Infinity", () => {
    const r = runEngine(workbookInput({ organizations: [], tasks: [] }));
    expect(r.overall.pctCat).toBeNull();
    expect(r.overall.overallAchievement).toBeNull();
    expect(r.kpi.totalSop).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
  });
  it("legacy row with no M/N/O = 'Not Input' (distinct from Not Started 0%) but counts as 0 in averages", () => {
    const notInput = newTask({ progress_source: "legacy", workflow_status: null, progress_percentage: null });
    const zero = newTask({ progress_source: "legacy", workflow_status: "Not Started", legacy_m: 0, progress_percentage: null });
    expect(sopProgress(notInput).status).toBe("Not Input");
    expect(sopProgress(notInput).value).toBeNull();
    expect(sopProgress(zero).status).toBe("Not Started");
    expect(sopProgress(zero).value).toBe(0);
    const r = runEngine(base([notInput, newTask({ progress_percentage: 100, workflow_status: "Completed" })]));
    expect(r.organizations[0].pctCat).toBeCloseTo(0.5);
  });
  it("with treatUninputAsZero=false, not-input SOPs are skipped", () => {
    const input = base([newTask({ progress_source: "legacy", workflow_status: null, progress_percentage: null }), newTask({ progress_percentage: 100, workflow_status: "Completed" })]);
    const r = runEngine({ ...input, settings: { ...DEFAULT_SETTINGS, treatUninputAsZero: false } });
    expect(r.organizations[0].pctCat).toBe(1);
  });
  it("garbage numbers (NaN, strings) are sanitised", () => {
    const p = sopProgress({ workflow_status: null, progress_source: "legacy", progress_percentage: null, legacy_m: Number.NaN, legacy_n: "abc" as unknown as number, legacy_o: Infinity });
    expect(p.value).toBeNull();
  });
});

describe("6. Missing organization", () => {
  it("task whose organization no longer exists is labelled, not crashing", () => {
    const r = runEngine(base([newTask({ organization_id: "ghost" })]));
    expect(r.tasks[0].organization_name).toMatch(/tidak ditemukan/);
    expect(r.organizations[0].totalSop).toBe(0);
  });
});

describe("7. Invalid dates", () => {
  it("invalid / missing dates give null working days", () => {
    expect(mandays("2027-02-30", "2027-03-01", new Set())).toBeNull();
    expect(mandays(null, "2027-03-01", new Set())).toBeNull();
    expect(networkDays("abc", "2027-01-01")).toBeNull();
  });
  it("form rejects End Date earlier than Start Date", () => {
    const res = sopInputSchema.safeParse({
      organization_id: "11111111-1111-4111-8111-111111111111",
      sop_name: "SOP X",
      task_type: "CAT",
      document_classification: "New",
      critical: false,
      start_date: "2027-03-10",
      end_date: "2027-03-01",
    });
    expect(res.success).toBe(false);
  });
  it("start > end in NETWORKDAYS returns a negative count (sheet semantics)", () => {
    expect(networkDays("2027-01-08", "2027-01-04")).toBe(-5);
  });
});

describe("8. Duplicate SOP", () => {
  it("same organization + same normalized name is detected", () => {
    const tasks = [newTask({ id: "a", sop_name: "SOP  Recruitment " })];
    expect(findDuplicateSop(tasks, "org-1", "sop recruitment")).not.toBeNull();
    expect(findDuplicateSop(tasks, "org-2", "sop recruitment")).toBeNull();
    expect(findDuplicateSop(tasks, "org-1", "sop recruitment", "a")).toBeNull();
  });
  it("archived SOPs do not block re-creation", () => {
    expect(findDuplicateSop([newTask({ sop_name: "SOP A", is_active: false })], "org-1", "SOP A")).toBeNull();
  });
});

describe("9–14. Working days", () => {
  const hs = buildHolidaySet(holidays());
  it("9. Mandays = NETWORKDAYS(start;end;holidays) − 1", () => {
    // 22/03–30/04/2027: 30 weekdays, 26/03 Good Friday → 29 − 1 = 28
    expect(mandays("2027-03-22", "2027-04-30", hs)).toBe(28);
  });
  it("10. Actual Days = NETWORKDAYS(start;actualEnd;holidays) − 1", () => {
    expect(actualDays("2027-03-22", "2027-05-07", hs)).toBe(32); // 29 (to 30/04) + 4 (03–07/05 minus Kenaikan 06/05) = 33 − 1
    expect(actualDays("2027-03-22", null, hs)).toBeNull();
  });
  it("11. Man Days = NETWORKDAYS(start;end) inclusive, ignores holidays", () => {
    expect(manDays("2027-03-22", "2027-04-30")).toBe(30);
  });
  it("12. National holidays on weekdays reduce working days; on weekends they don't double count", () => {
    expect(networkDays("2027-03-08", "2027-03-12", hs)).toBe(2); // Nyepi 8, Idulfitri 10–11
    expect(networkDays("2027-02-01", "2027-02-07", hs)).toBe(5); // Imlek 06/02 is Saturday
  });
  it("13. Joint leave only counts when the Administrator enables it", () => {
    const off = buildHolidaySet(holidays({ jointLeaveExcluded: false }));
    const on = buildHolidaySet(holidays({ jointLeaveExcluded: true }));
    expect(mandays("2027-02-15", "2027-03-24", off)).toBe(24);
    expect(mandays("2027-02-15", "2027-03-24", on)).toBe(21); // 09/03, 12/03, 15/03
  });
  it("14. Additional company holiday is respected", () => {
    const list = [...holidays(), { id: "c", holiday_date: "2027-04-14", holiday_name: "HUT GK Group", category: "Company Holiday" as const, description: null, exclude_from_working_days: true, source: "Internal" }];
    expect(mandays("2027-03-22", "2027-04-30", buildHolidaySet(list))).toBe(27);
  });
});

describe("15–16. Monthly Achievement weights", () => {
  const targets = Array.from({ length: 12 }, (_, i) => ({ year: 2027, month: i + 1, target: 0.1, completion_weight: i + 1 >= 10 ? 0.7 : 1, awareness_weight: i + 1 >= 10 ? 0.3 : 0 }));
  it("15. Jan–Sep = 100% × Completion (awareness ignored)", () => {
    const rows = computeMonthly(2027, targets, [{ year: 2027, month: 3, sop_completion: 0.45, sop_awareness: 0.9 }]);
    expect(rows[2].total).toBeCloseTo(0.45);
    expect(rows[2].variance).toBeCloseTo(0.35);
  });
  it("16. Oct–Dec = 70% × Completion + 30% × Awareness", () => {
    const rows = computeMonthly(2027, targets, [{ year: 2027, month: 11, sop_completion: 1, sop_awareness: 0.8 }]);
    expect(rows[10].total).toBeCloseTo(0.94);
  });
  it("no input → total 0 with hasInput=false", () => {
    const rows = computeMonthly(2027, targets, []);
    expect(rows[0].total).toBe(0);
    expect(rows[0].hasInput).toBe(false);
  });
});

describe("17–21. Add / Edit / Archive SOP, Gantt update, Organization update", () => {
  const start = workbookInput();
  const before = runEngine(start);
  it("17. Adding a SOP updates totals, division and overall", () => {
    const added = newTask({ id: "new", organization_id: "org-8", task_number: "8.4", task_seq: 4, sop_name: "SOP Brand Guideline", task_type: "CAT", progress_percentage: 100, workflow_status: "Completed", start_date: "2027-02-01", end_date: "2027-02-26" });
    const after = runEngine({ ...start, tasks: [...start.tasks, added] });
    expect(after.kpi.totalSop).toBe(before.kpi.totalSop + 1);
    const marcom = after.organizations.find((o) => o.organization.organization_name === "Marcom")!;
    expect(marcom.pctCat).toBe(1);
    expect(after.overall.orgsWithCat).toBe(8);
    expect(after.overall.pctCat).toBeCloseTo((0.5 + 0.5 / 3 + 1) / 8, 10);
    expect(after.tasks.find((t) => t.id === "new")!.mandays).toBe(19);
  });
  it("18. Editing progress updates the division %", () => {
    const tasks = start.tasks.map((t) => (t.task_number === "3.1" ? { ...t, progress_source: "direct" as const, progress_percentage: 60, workflow_status: "In Progress" as const } : t));
    const after = runEngine({ ...start, tasks });
    expect(after.organizations.find((o) => o.organization.organization_name === "Procurement")!.pctCat).toBeCloseTo(0.6);
  });
  it("19. Archiving a SOP removes it from every calculation", () => {
    const tasks = start.tasks.map((t) => (t.task_number === "1.1" ? { ...t, is_active: false } : t));
    const after = runEngine({ ...start, tasks });
    expect(after.organizations[0].pctCat).toBeNull();
    expect(after.kpi.totalSop).toBe(25);
    expect(after.tasks.some((t) => t.task_number === "1.1")).toBe(false);
  });
  it("20. Changing dates moves the Gantt bar", () => {
    const t = newTask({ start_date: "2027-01-11", end_date: "2027-01-22", progress_percentage: 50, workflow_status: "In Progress" });
    const p = sopProgress(t);
    const g1 = barGeometry(t, p, "2026-12-28", 400, "2026-11-24")!;
    const g2 = barGeometry({ ...t, end_date: "2027-01-29" }, p, "2026-12-28", 400, "2026-11-24")!;
    expect(g1.offset).toBe(14);
    expect(g1.length).toBe(12);
    expect(g1.progressDays).toBe(6); // ROUNDDOWN(12 × 0.5)
    expect(g2.length).toBe(19);
    expect(g2.progressDays).toBe(9);
  });
  it("20b. Overdue flag when End Date passed and not completed", () => {
    const t = newTask({ start_date: "2027-01-04", end_date: "2027-01-08", progress_percentage: 50, workflow_status: "In Progress" });
    expect(barGeometry(t, sopProgress(t), "2026-12-28", 400, "2027-02-01")!.overdue).toBe(true);
  });
  it("21. Renaming an organization is reflected on its SOPs", () => {
    const orgs = start.organizations.map((o) => (o.sort_order === 4 ? { ...o, organization_name: "IT Management" } : o));
    const after = runEngine({ ...start, organizations: orgs });
    expect(after.tasks.filter((t) => t.organization_name === "IT Management")).toHaveLength(4);
    expect(after.organizations.find((o) => o.organization.organization_name === "IT Management")!.pctCat).toBeCloseTo(0.5 / 3);
  });
});

describe("Validation helpers", () => {
  it("status/progress consistency", () => {
    expect(validateStatusProgress("Not Started", 0)).toBeNull();
    expect(validateStatusProgress("Not Started", 5)).not.toBeNull();
    expect(validateStatusProgress("In Progress", 100)).not.toBeNull();
    expect(validateStatusProgress("Completed", 100)).toBeNull();
    expect(validateStatusProgress("Hold", 40)).toBeNull();
    expect(progressInputSchema.safeParse({ workflow_status: "In Progress", progress_percentage: "45" }).success).toBe(true);
  });
  it("required fields on Add New SOP", () => {
    const res = sopInputSchema.safeParse({ organization_id: "", sop_name: " ", task_type: "", document_classification: "New", critical: false });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["organization_id", "sop_name", "task_type"]));
    }
  });
  it("weights must total 100", () => {
    expect(weightsSchema.safeParse({ cat: 80, additional: 20 }).success).toBe(true);
    expect(weightsSchema.safeParse({ cat: 80, additional: 25 }).success).toBe(false);
  });
});

describe("25. Export consistency", () => {
  const input = workbookInput();
  const r = runEngine(input);
  it("division report = engine values", () => {
    const rep = buildReport("division-progress", r, input.holidays, input.settings.weights);
    for (const row of rep.rows) {
      const o = r.organizations.find((x) => x.organization.organization_name === row.organization)!;
      expect(row.pct_cat).toBe(o.pctCat);
      expect(row.pct_additional).toBe(o.pctAdditional);
    }
  });
  it("overall report = engine values", () => {
    const rep = buildReport("overall-achievement", r, input.holidays, input.settings.weights);
    expect(rep.rows[2].value).toBe(r.overall.overallAchievement);
    expect((rep.rows[0].contribution as number) + (rep.rows[1].contribution as number)).toBeCloseTo(r.overall.overallAchievement!, 12);
  });
  it("SOP master list has one row per active SOP with engine progress", () => {
    const rep = buildReport("sop-master", r, input.holidays, input.settings.weights);
    expect(rep.rows).toHaveLength(26);
    expect(rep.rows.find((x) => x.task_number === "4.3")!.progress).toBe(0.5);
  });
  it("CSV contains the same overall numbers", () => {
    const csv = toCsv(buildReport("cat-achievement", r, input.holidays, input.settings.weights));
    expect(csv).toContain("9.5238");
  });
  it("monthly and holiday reports", () => {
    expect(buildReport("monthly-achievement", r, input.holidays, input.settings.weights).rows[11].total).toBeCloseTo(1.11);
    expect(buildReport("holidays", r, input.holidays, input.settings.weights).rows).toHaveLength(26);
  });
});
