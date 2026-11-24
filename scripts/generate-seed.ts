// Generates supabase/migrations/20261124000003_seed_2027.sql from the audited workbook snapshot
// (tests/fixtures/spc-schedule-2027.json) using the SAME parser as the in-app importer.
//   npm run seed:generate

import { writeFileSync } from "node:fs";
import path from "node:path";
import fixture from "../tests/fixtures/spc-schedule-2027.json";
import { parseSpcGrid, sparseRowsToGrid, type Cell } from "../src/lib/import/spc-parser";
import { DEFAULT_MONTHLY_TARGETS, defaultWeights } from "../src/lib/engine/monthly";

const q = (v: string | null | undefined) => (v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined) => (v === null || v === undefined ? "null" : String(v));
const b = (v: boolean) => (v ? "true" : "false");

const parsed = parseSpcGrid(sparseRowsToGrid(fixture.rows as Array<Record<string, Cell> & { r: number }>));
if (parsed.stats.tasksInvalid > 0) throw new Error("Fixture contains invalid rows");

const CODES: Record<string, string> = {
  Legal: "LGL", GA: "GA", Procurement: "PRC", ITM: "ITM", "R & A": "RNA", HC: "HC", FAT: "FAT",
  Marcom: "MCM", Exrel: "EXR", SPM: "SPM", GBU: "GBU", "Pilar Technology": "PLR",
};

const NATIONAL: Array<[string, string]> = [
  ["2027-01-01", "Tahun Baru 2027 Masehi"],
  ["2027-01-05", "Isra Mikraj Nabi Muhammad saw."],
  ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili"],
  ["2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)"],
  ["2027-03-10", "Idulfitri 1448 Hijriah (hari 1)"],
  ["2027-03-11", "Idulfitri 1448 Hijriah (hari 2)"],
  ["2027-03-26", "Wafat Yesus Kristus"],
  ["2027-03-28", "Hari Kebangkitan Yesus Kristus (Paskah)"],
  ["2027-05-01", "Hari Buruh Internasional"],
  ["2027-05-06", "Kenaikan Yesus Kristus"],
  ["2027-05-17", "Iduladha 1448 Hijriah"],
  ["2027-05-20", "Hari Raya Waisak 2571 BE"],
  ["2027-06-01", "Hari Lahir Pancasila"],
  ["2027-06-06", "1 Muharam Tahun Baru Islam 1449 Hijriah"],
  ["2027-08-15", "Maulid Nabi Muhammad SAW"],
  ["2027-08-17", "Proklamasi Kemerdekaan"],
  ["2027-12-25", "Kelahiran Yesus Kristus (Natal)"],
  ["2027-12-26", "Isra Mikraj Nabi Muhammad saw."],
];
const JOINT: Array<[string, string]> = [
  ["2027-02-05", "Cuti Bersama Tahun Baru Imlek 2578 Kongzili"],
  ["2027-03-09", "Cuti Bersama Idulfitri 1448 Hijriah"],
  ["2027-03-12", "Cuti Bersama Idulfitri 1448 Hijriah"],
  ["2027-03-15", "Cuti Bersama Idulfitri 1448 Hijriah"],
  ["2027-03-25", "Cuti Bersama Wafat Yesus Kristus"],
  ["2027-05-18", "Cuti Bersama Iduladha 1448 H"],
  ["2027-05-19", "Cuti Bersama Waisak 2571 BE"],
  ["2027-12-24", "Cuti Bersama Kelahiran Yesus Kristus (Natal)"],
];
const SKB = "SKB Menag/Menaker/MenPAN-RB No. 1205/2026, 3/2026, 2/2026";

// Sanity: the sheet's holiday list must equal the SKB national list.
const sheetHolidays = parsed.holidays.join(",");
if (sheetHolidays !== NATIONAL.map(([d]) => d).join(",")) throw new Error(`Holiday list differs from SKB: ${sheetHolidays}`);

const seed = {
  admins: ["michael.damar@gankapital.com"],
  settings: {
    weights: { value: { cat: 80, additional: 20 }, description: "Bobot Overall Achievement (%). Total wajib 100." },
    project: { value: { start: "2027-01-01", end: "2027-12-31", name: "SPC Project Schedule 2027" }, description: "Periode project (M4:M5)." },
    treat_uninput_as_zero: { value: true, description: "SOP tanpa input progres dihitung 0 pada rata-rata divisi (perilaku workbook)." },
    source: { value: { spreadsheet_id: "13Sd-CqyoLq9cJVCsUMAj-HVWGoQtG41d4RywBPyMntc", sheet_name: "SPC Schedule 2027" }, description: "Sumber impor (read-only)." },
    oauth_client_id: { value: null, description: "Google OAuth Client ID untuk login Administrator." },
  },
  organizations: parsed.organizations.map((o) => ({
    organization_name: o.organization_name,
    organization_code: CODES[o.organization_name] ?? null,
    sort_order: o.sort_order,
    description: `Migrasi dari SPC Schedule 2027 baris ${o.source_row}`,
  })),
  tasks: parsed.tasks.map((t) => ({
    org_sort: t.org_sort,
    task_seq: t.task_seq,
    task_number: t.task_number,
    sop_name: t.sop_name,
    task_type: t.task_type,
    document_classification: t.document_classification,
    workflow_status: t.workflow_status,
    critical: t.critical,
    start_date: t.start_date,
    end_date: t.end_date,
    actual_end_date: t.actual_end_date,
    legacy_m: t.legacy_m,
    legacy_n: t.legacy_n,
    legacy_o: t.legacy_o,
    remark: t.remark,
    source_row: t.source_row,
  })),
  holidays: [
    ...NATIONAL.map(([d, name]) => ({ holiday_date: d, holiday_name: name, category: "National Holiday", description: null, exclude_from_working_days: true, source: `${SKB}; Google Sheets G91:G108` })),
    ...JOINT.map(([d, name]) => ({ holiday_date: d, holiday_name: name, category: "Joint Leave", description: "Menunggu keputusan Administrator apakah menjadi hari non-kerja perusahaan.", exclude_from_working_days: false, source: SKB })),
  ],
  monthly: parsed.monthly.map((m) => ({
    year: 2027,
    month: m.month,
    target: m.target ?? DEFAULT_MONTHLY_TARGETS[m.month - 1],
    ...defaultWeights(m.month),
    sop_completion: m.sop_completion,
    sop_awareness: m.sop_awareness,
  })),
};

const header = `// GENERATED by scripts/generate-seed.ts – do not edit by hand.
// Source: ${fixture.source}
// Initial data (audited workbook + SKB 3 Menteri 2027). Used only by setupDatabase() when the tabs are empty.
`;
const file = path.join(__dirname, "..", "apps-script", "Seed.gs");
writeFileSync(file, `${header}var SEED = ${JSON.stringify(seed, null, 1)};\n`);
console.log(`Wrote ${file}: ${seed.organizations.length} organizations, ${seed.tasks.length} SOPs, ${seed.holidays.length} holidays`);
