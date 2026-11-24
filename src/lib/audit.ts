import { formatDateId, isValidIsoDate } from "./engine/dates";

export type { AuditLog } from "./data-model";
import type { AuditLog } from "./data-model";

export const TABLE_LABEL: Record<string, string> = {
  sop_tasks: "SOP",
  organizations: "Organisasi",
  holidays: "Hari libur",
  monthly_targets: "Target bulanan",
  monthly_achievements: "Monthly Achievement",
  system_settings: "System Settings",
  admins: "Administrator",
};

const FIELD_LABEL: Record<string, string> = {
  sop_name: "Nama SOP",
  organization_id: "Organisasi",
  task_type: "Jenis tugas",
  document_classification: "New/Revision",
  workflow_status: "Status",
  critical: "Critical",
  start_date: "Start Date",
  end_date: "End Date",
  actual_end_date: "Actual End Date",
  progress_percentage: "Progress",
  progress_source: "Sumber progres",
  legacy_m: "Not Start (M)",
  legacy_n: "In Work (N)",
  legacy_o: "Complete (O)",
  remark: "Remark",
  is_active: "Aktif",
  task_number: "Task Number",
  task_seq: "Urutan",
  organization_name: "Nama organisasi",
  organization_code: "Kode",
  description: "Deskripsi",
  sort_order: "Nomor urut",
  holiday_date: "Tanggal",
  holiday_name: "Nama hari libur",
  category: "Kategori",
  exclude_from_working_days: "Exclude from Working Days",
  source: "Sumber",
  target: "Target",
  completion_weight: "Bobot Completion",
  awareness_weight: "Bobot Awareness",
  sop_completion: "SOP Completion",
  sop_awareness: "SOP Awareness",
  value: "Nilai",
};

export function fieldLabel(f: string) {
  return FIELD_LABEL[f] ?? f;
}

export function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(kosong)";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (typeof v === "string" && isValidIsoDate(v.slice(0, 10)) && v.length === 10) return formatDateId(v);
  if (["target", "completion_weight", "awareness_weight", "sop_completion", "sop_awareness", "legacy_m", "legacy_n", "legacy_o"].includes(field) && typeof v === "number")
    return `${Math.round(v * 10000) / 100}%`;
  if (field === "progress_percentage") return `${v}%`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function recordLabel(log: AuditLog): string {
  const d = (log.new_data ?? log.old_data ?? {}) as Record<string, unknown>;
  switch (log.table_name) {
    case "sop_tasks":
      return `SOP ${d.task_number ?? ""} "${d.sop_name ?? ""}"`;
    case "organizations":
      return `organisasi "${d.organization_name ?? ""}"`;
    case "holidays":
      return `hari libur "${d.holiday_name ?? ""}" (${formatValue("holiday_date", d.holiday_date)})`;
    case "monthly_targets":
    case "monthly_achievements":
      return `${TABLE_LABEL[log.table_name]} ${d.month}/${d.year}`;
    case "system_settings":
      return `pengaturan "${d.key ?? ""}"`;
    case "admins":
      return `administrator ${d.email ?? ""}`;
    default:
      return `${TABLE_LABEL[log.table_name] ?? log.table_name} ${log.record_id ?? ""}`;
  }
}

/** Human readable sentence, e.g. "Mengubah End Date SOP 1.1 "…" dari 15 Feb 2027 menjadi 20 Feb 2027". */
export function describe(log: AuditLog): string[] {
  const who = recordLabel(log);
  if (log.action === "INSERT") return [`Menambahkan ${who}`];
  if (log.action === "DELETE") return [`Menghapus ${who}`];
  return (log.changed_fields ?? []).map(
    (f) => `Mengubah ${fieldLabel(f)} ${who} dari ${formatValue(f, log.old_data?.[f])} menjadi ${formatValue(f, log.new_data?.[f])}`,
  );
}
