// Tests for the real Apps Script backend (apps-script/Code.gs) running in a VM with fake Google services.

import { beforeEach, describe, expect, it } from "vitest";
import { runEngine, mandays, buildHolidaySet } from "@/lib/engine";
import { toEngineInput, type PublicData } from "@/lib/data-model";
import { parseSpcGrid } from "@/lib/import/spc-parser";
import { createBackend, FakeSpreadsheet, CLIENT_ID } from "./harness";
import { grid } from "../helpers";

const ADMIN = "michael.damar@gankapital.com";
let be: ReturnType<typeof createBackend>;
let adminTok: string;

const pub = (): PublicData => be.get("publicData").data;
const engine = () => runEngine(toEngineInput(pub(), { today: "2026-11-24" }));
const orgId = (name: string) => pub().organizations.find((o) => o.organization_name === name)!.id;

beforeEach(() => {
  be = createBackend();
  be.setup();
  adminTok = be.login(ADMIN);
});

describe("Setup & storage round-trip", () => {
  it("creates all tabs and seeds the audited workbook data", () => {
    const d = pub();
    expect(d.organizations).toHaveLength(12);
    expect(d.tasks).toHaveLength(26);
    expect(d.holidays).toHaveLength(26);
    expect(d.monthlyTargets).toHaveLength(12);
    expect(be.tab("audit_logs")).toBeTruthy();
  });
  it("data read back from Google Sheets reproduces the workbook (Overall 16,95%)", () => {
    const r = engine();
    expect(r.overall.pctCat).toBeCloseTo(0.0952380952, 9);
    expect(r.overall.pctAdditional).toBeCloseTo(0.4666666667, 9);
    expect(r.overall.overallAchievement).toBeCloseTo(0.1695238095, 9);
    expect(r.monthly.map((m) => Math.round(m.total * 100))).toEqual([20, 0, 0, 0, 0, 0, 0, 0, 0, 49, 94, 111]);
  });
  it("stores every cell as text so Sheets never turns task numbers or dates into numbers", () => {
    const tasks = be.tab("sop_tasks").data;
    const header = tasks[0] as string[];
    const row = tasks.find((r) => r[header.indexOf("task_number")] === "7.10" || r[header.indexOf("task_number")] === "1.1")!;
    expect(typeof row[header.indexOf("task_number")]).toBe("string");
    expect(row[header.indexOf("start_date")]).toBe("2027-03-22");
  });
  it("setup is idempotent", () => {
    be.setup();
    expect(pub().tasks).toHaveLength(26);
  });
  it("seeds the initial admin and the Apps Script owner", () => {
    const admins = be.post("adminData", adminTok).data.admins.map((a: { email: string }) => a.email);
    expect(admins).toEqual(expect.arrayContaining([ADMIN, "owner@gankapital.com"]));
  });
});

describe("Authentication & authorization (public read-only)", () => {
  it("public data needs no login and hides archived SOPs, admins and audit log", () => {
    const d = be.get("publicData");
    expect(d.ok).toBe(true);
    expect(d.data.admins).toBeUndefined();
    expect(JSON.stringify(d.data)).not.toContain("audit");
  });
  it("config exposes only the OAuth client id", () => {
    expect(be.get("config").data).toEqual({ oauthClientId: CLIENT_ID, version: 1 });
  });
  it("write without token → auth error", () => {
    const r = be.post("createSop", null, { sop_name: "x" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("auth");
  });
  it("forged / unknown token → auth error", () => {
    expect(be.post("createSop", "forged-token", {}).code).toBe("auth");
  });
  it("token issued for another app (wrong aud) → rejected", () => {
    const t = be.login(ADMIN, { aud: "other-app.apps.googleusercontent.com" });
    expect(be.post("adminData", t).code).toBe("auth");
  });
  it("expired or unverified token → rejected", () => {
    expect(be.post("adminData", be.login(ADMIN, { exp: Math.floor(Date.now() / 1000) - 10 })).code).toBe("auth");
    expect(be.post("adminData", be.login(ADMIN, { email_verified: "false" })).code).toBe("auth");
  });
  it("valid Google account that is not an admin → forbidden for reads and writes", () => {
    const t = be.login("someone@gankapital.com");
    expect(be.post("whoami", t).data).toEqual({ email: "someone@gankapital.com", isAdmin: false });
    expect(be.post("adminData", t).code).toBe("forbidden");
    expect(be.post("auditLog", t).code).toBe("forbidden");
    expect(be.post("setSopActive", t, { id: pub().tasks[0].id, active: false }).code).toBe("forbidden");
    expect(pub().tasks).toHaveLength(26);
  });
  it("admin is recognised and token verification is cached", () => {
    expect(be.post("whoami", adminTok).data.isAdmin).toBe(true);
    const n = be.fetchCount;
    be.post("adminData", adminTok);
    expect(be.fetchCount).toBe(n);
  });
  it("unknown action is rejected", () => {
    expect(be.post("dropTable", adminTok).code).toBe("not_found");
  });
});

describe("SOP CRUD, validation and audit", () => {
  const newSop = (extra = {}) => ({
    organization_id: orgId("Marcom"),
    sop_name: "SOP Brand Guideline",
    task_type: "CAT",
    document_classification: "New",
    critical: true,
    start_date: "2027-02-01",
    end_date: "2027-02-26",
    remark: "",
    ...extra,
  });

  it("Add New SOP: auto task number, Not Started 0%, audit + history, visible publicly", () => {
    const r = be.post("createSop", adminTok, newSop());
    expect(r.ok).toBe(true);
    expect(r.data.task_number).toBe("8.1");
    const t = pub().tasks.find((x) => x.sop_name === "SOP Brand Guideline")!;
    expect(t.workflow_status).toBe("Not Started");
    expect(t.progress_percentage).toBe(0);
    const audit = be.post("auditLog", adminTok).data.rows;
    expect(audit[0]).toMatchObject({ action: "INSERT", table_name: "sop_tasks", user_email: ADMIN });
    expect(be.post("taskHistory", adminTok, { id: t.id }).data).toHaveLength(1);
    expect(engine().tasks.find((x) => x.task_number === "8.1")!.mandays).toBe(19);
  });
  it("validation: required fields, date order, duplicates", () => {
    const r1 = be.post("createSop", adminTok, { sop_name: " ", task_type: "", document_classification: "New" });
    expect(r1.code).toBe("validation");
    expect(Object.keys(r1.errors!)).toEqual(expect.arrayContaining(["organization_id", "sop_name", "task_type"]));
    expect(be.post("createSop", adminTok, newSop({ start_date: "2027-03-10", end_date: "2027-03-01" })).errors!.end_date).toMatch(/tidak boleh lebih awal/);
    expect(be.post("createSop", adminTok, newSop({ start_date: "2027-02-30", end_date: "" })).errors!.start_date).toMatch(/tidak valid/);
    be.post("createSop", adminTok, newSop());
    expect(be.post("createSop", adminTok, newSop({ sop_name: "  sop BRAND   guideline " })).errors!.sop_name).toMatch(/Sudah ada SOP/);
  });
  it("edit End Date → audit keeps previous and new value; Gantt/mandays follow", () => {
    const { data } = be.post("createSop", adminTok, newSop());
    const r = be.post("updateSop", adminTok, newSop({ id: data.id, end_date: "2027-03-05" }));
    expect(r.ok).toBe(true);
    const log = be.post("auditLog", adminTok, { action: "UPDATE", table: "sop_tasks" }).data.rows[0];
    expect(log.changed_fields).toEqual(["end_date"]);
    expect(log.old_data.end_date).toBe("2027-02-26");
    expect(log.new_data.end_date).toBe("2027-03-05");
    expect(engine().tasks.find((x) => x.id === data.id)!.mandays).toBe(24);
  });
  it("moving a SOP to another organization renumbers it", () => {
    const { data } = be.post("createSop", adminTok, newSop());
    be.post("updateSop", adminTok, newSop({ id: data.id, organization_id: orgId("Legal") }));
    expect(pub().tasks.find((x) => x.id === data.id)!.task_number).toBe("1.3");
  });
  it("progress: status/percentage consistency is enforced, legacy switches to direct", () => {
    const legacy = pub().tasks.find((x) => x.task_number === "3.1")!;
    expect(be.post("updateProgress", adminTok, { id: legacy.id, workflow_status: "Completed", progress_percentage: 50 }).code).toBe("validation");
    expect(be.post("updateProgress", adminTok, { id: legacy.id, workflow_status: "In Progress", progress_percentage: 0 }).code).toBe("validation");
    expect(be.post("updateProgress", adminTok, { id: legacy.id, workflow_status: "In Progress", progress_percentage: 60, actual_end_date: "" }).ok).toBe(true);
    const t = pub().tasks.find((x) => x.id === legacy.id)!;
    expect(t.progress_source).toBe("direct");
    expect(t.legacy_m).toBe(0); // raw workbook value kept
    expect(engine().organizations.find((o) => o.organization.organization_name === "Procurement")!.pctCat).toBeCloseTo(0.6);
  });
  it("archive hides from public & calculations; restore brings it back; hard delete needs confirmation", () => {
    const t = pub().tasks.find((x) => x.task_number === "1.1")!;
    be.post("setSopActive", adminTok, { id: t.id, active: false });
    expect(pub().tasks).toHaveLength(25);
    expect(engine().organizations[0].pctCat).toBeNull();
    be.post("setSopActive", adminTok, { id: t.id, active: true });
    expect(pub().tasks).toHaveLength(26);
    expect(be.post("deleteSop", adminTok, { id: t.id, confirmation: "1.2" }).code).toBe("validation");
    expect(be.post("deleteSop", adminTok, { id: t.id, confirmation: "1.1" }).ok).toBe(true);
    expect(pub().tasks.some((x) => x.id === t.id)).toBe(false);
    expect(be.post("auditLog", adminTok, { action: "DELETE" }).data.rows[0].old_data.sop_name).toBe("SOP Penyimpanan Dokumen Legal");
  });
  it("text that looks like a formula is stored literally", () => {
    be.post("createSop", adminTok, newSop({ sop_name: '=HYPERLINK("http://evil","x")' }));
    expect(pub().tasks.some((x) => x.sop_name === '=HYPERLINK("http://evil","x")')).toBe(true);
  });
  it("public cache is invalidated after a write", () => {
    pub();
    be.post("createSop", adminTok, newSop());
    expect(pub().tasks).toHaveLength(27);
  });
});

describe("Organizations, holidays, monthly, settings, admins", () => {
  it("organization add / rename / deactivate", () => {
    expect(be.post("saveOrganization", adminTok, { organization_name: "Corporate Secretary", organization_code: "corsec" }).ok).toBe(true);
    const o = be.post("adminData", adminTok).data.organizations.find((x: { organization_name: string }) => x.organization_name === "Corporate Secretary");
    expect(o).toMatchObject({ sort_order: 13, organization_code: "CORSEC" });
    expect(be.post("saveOrganization", adminTok, { organization_name: "legal" }).errors!.organization_name).toMatch(/sudah digunakan/);
    be.post("saveOrganization", adminTok, { id: orgId("ITM"), organization_name: "IT Management", organization_code: "ITM" });
    expect(engine().tasks.filter((t) => t.organization_name === "IT Management")).toHaveLength(4);
    be.post("setOrganizationActive", adminTok, { id: o.id, active: false });
    expect(pub().organizations.some((x) => x.id === o.id)).toBe(false);
  });
  it("joint leave becomes non-working only when the admin decides", () => {
    const t63 = () => engine().tasks.find((x) => x.task_number === "6.3")!.mandays;
    expect(t63()).toBe(24);
    be.post("setCategoryExclude", adminTok, { category: "Joint Leave", exclude: true });
    expect(t63()).toBe(21);
    be.post("setCategoryExclude", adminTok, { category: "Joint Leave", exclude: false });
    expect(t63()).toBe(24);
  });
  it("company holiday add/edit/delete recalculates working days", () => {
    const r = be.post("saveHoliday", adminTok, { holiday_date: "2027-04-14", holiday_name: "HUT GK Group", category: "Company Holiday", exclude_from_working_days: true });
    expect(r.ok).toBe(true);
    const hs = () => buildHolidaySet(toEngineInput(pub()).holidays);
    expect(mandays("2027-03-22", "2027-04-30", hs())).toBe(27);
    const h = pub().holidays.find((x) => x.holiday_name === "HUT GK Group")!;
    expect(be.post("saveHoliday", adminTok, { holiday_date: "2027-02-30", holiday_name: "x", category: "Company Holiday" }).errors!.holiday_date).toBeTruthy();
    be.post("deleteHoliday", adminTok, { id: h.id });
    expect(mandays("2027-03-22", "2027-04-30", hs())).toBe(28);
  });
  it("monthly achievement save (Jan–Sep 100/0, Oct–Dec 70/30)", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, target: 0.1 * (i < 9 ? 1 : 1), completion_weight: i + 1 >= 10 ? 0.7 : 1, sop_completion: i === 1 ? 0.25 : null, sop_awareness: i === 10 ? 0.8 : null }));
    rows[10].sop_completion = 1 as never;
    expect(be.post("saveMonthly", adminTok, { year: 2027, rows }).ok).toBe(true);
    const m = engine().monthly;
    expect(m[1].total).toBeCloseTo(0.25);
    expect(m[10].total).toBeCloseTo(0.94);
    rows[0].completion_weight = 1.5;
    expect(be.post("saveMonthly", adminTok, { year: 2027, rows }).errors!.cw_1).toBeTruthy();
  });
  it("weights must total 100; 70/30 changes Overall", () => {
    const base = { project: { start: "2027-01-01", end: "2027-12-31" }, treat_uninput_as_zero: true };
    expect(be.post("saveSettings", adminTok, { ...base, weights: { cat: 80, additional: 30 } }).errors!.weight_cat).toBeTruthy();
    expect(be.post("saveSettings", adminTok, { ...base, weights: { cat: 70, additional: 30 } }).ok).toBe(true);
    expect(engine().overall.overallAchievement).toBeCloseTo(0.0952380952 * 0.7 + 0.4666666667 * 0.3, 9);
  });
  it("admins: add → can write; cannot deactivate self; last admin protected; deactivated admin loses access", () => {
    const succ = "successor@gankapital.com";
    expect(be.post("addAdmin", adminTok, { email: "Successor@GanKapital.com" }).ok).toBe(true);
    const st = be.login(succ);
    expect(be.post("whoami", st).data.isAdmin).toBe(true);
    expect(be.post("setAdminActive", adminTok, { email: ADMIN, active: false }).code).toBe("validation");
    expect(be.post("setAdminActive", st, { email: ADMIN, active: false }).ok).toBe(true);
    expect(be.post("adminData", adminTok).code).toBe("forbidden");
    expect(be.post("setAdminActive", st, { email: "owner@gankapital.com", active: false }).ok).toBe(true);
    expect(be.post("setAdminActive", st, { email: succ, active: false }).code).toBe("validation");
  });
});

describe("Import from the source workbook", () => {
  it("fetchSource reads the SPC sheet read-only; dates come back as yyyy-mm-dd", () => {
    const src = new FakeSpreadsheet();
    const sh = src.insertSheet("SPC Schedule 2027");
    // put the audited grid in, with real Date objects for H/I like Sheets returns
    sh.data = grid.map((row) => (row ?? []).map((v, c) => (typeof v === "number" && [7, 8, 10].includes(c) && v > 40000 ? new Date(Date.UTC(1899, 11, 30) + v * 86400000 - 7 * 3600000) : (v ?? ""))));
    be = createBackend({ source: src });
    be.setup();
    adminTok = be.login(ADMIN);
    const r = be.post("fetchSource", adminTok);
    expect(r.ok).toBe(true);
    const parsed = parseSpcGrid(r.data);
    expect(parsed.tasks).toHaveLength(26);
    expect(parsed.tasks[0].start_date).toBe("2027-03-22");
  });
  it("commit into an empty database reproduces the workbook; re-import does not duplicate", () => {
    be = createBackend();
    be.setup();
    adminTok = be.login(ADMIN);
    // wipe seeded tasks to simulate a fresh database
    const sh = be.tab("sop_tasks");
    sh.data = [sh.data[0]];
    const parsed = parseSpcGrid(grid);
    const payload = { mode: "insert-only", includeMonthly: true, organizations: parsed.organizations, tasks: parsed.tasks, monthly: parsed.monthly };
    const r1 = be.post("importCommit", adminTok, payload);
    expect(r1.data).toMatchObject({ inserted: 26, skipped: 0, failed: [] });
    expect(engine().overall.overallAchievement).toBeCloseTo(0.1695238095, 9);
    expect(be.post("importCommit", adminTok, payload).data).toMatchObject({ inserted: 0, skipped: 26 });
    const bad = be.post("importCommit", adminTok, { ...payload, tasks: [{ ...parsed.tasks[0], sop_name: "Baru", task_type: "XYZ" }] });
    expect(bad.data.failed[0].error).toMatch(/kategori/);
  });
});
