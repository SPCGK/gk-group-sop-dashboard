"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Save } from "lucide-react";
import { useApp } from "../app-provider";
import type { EnrichedTask, Organization } from "@/lib/engine";
import { fmtPct } from "@/lib/engine";
import { formatDateId } from "@/lib/engine/dates";
import { DataTable, type Column, type FilterDef } from "../data-table";
import { CategoryBadge, StageBadge, STAGE_META, STAGE_ORDER } from "../status";
import { initialStageChoice, stagePayload, StageOptions, type StageChoice } from "./progress-form";
import { sopStage } from "@/lib/engine/progress";
import { Badge, cn } from "../ui";

export type AdminRow = EnrichedTask;

function QuickProgress({ row }: { row: AdminRow }) {
  const { call } = useApp();
  const [pending, start] = useTransition();
  const status = row.progress.status === "Not Input" ? null : row.progress.status;
  const percent = row.progress.value === null ? null : row.progress.value * 100;
  const initial = initialStageChoice(status, percent);
  const [choice, setChoice] = useState<StageChoice>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = choice !== "" && choice !== initial;
  return (
    <div className="flex min-w-[17rem] items-center gap-1.5">
      <select value={choice} onChange={(e) => setChoice(e.target.value as StageChoice)} className="h-8 max-w-[14rem] rounded-md border border-line bg-white px-1.5 text-xs" aria-label={`Tahap progres ${row.task_number}`}>
        <StageOptions includeEmpty={choice === ""} emptyLabel={status && percent !== null ? `${Math.round(percent)}% – pilih tahap` : "Belum diinput"} />
      </select>
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() =>
          start(async () => {
            if (!choice) return;
            const r = await call("updateProgress", { id: row.id, ...stagePayload(choice, percent), actual_end_date: row.actual_end_date ?? "" });
            setMsg({ ok: r.ok, text: r.ok ? "Tersimpan" : (r.errors?.progress_percentage ?? r.message ?? "Gagal") });
          })
        }
        className="inline-flex h-8 items-center gap-1 rounded-md bg-ink px-2 text-xs font-medium text-white disabled:opacity-30"
      >
        <Save className="size-3" /> {pending ? "…" : "Simpan"}
      </button>
      {msg ? <span className={cn("text-[11px]", msg.ok ? "text-ok" : "text-bad")}>{msg.text}</span> : null}
    </div>
  );
}

function ArchiveButton({ row }: { row: AdminRow }) {
  const { call } = useApp();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (row.is_active && !window.confirm(`Arsipkan SOP ${row.task_number} "${row.sop_name}"?`)) return;
        start(async () => {
          const r = await call("setSopActive", { id: row.id, active: !row.is_active });
          if (!r.ok) window.alert(r.message);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-canvas disabled:opacity-40"
    >
      {row.is_active ? <Archive className="size-3" /> : <ArchiveRestore className="size-3" />}
      {row.is_active ? "Arsipkan" : "Pulihkan"}
    </button>
  );
}

export function AdminSopTable({ rows, organizations, mode }: { rows: AdminRow[]; organizations: Organization[]; mode: "progress" | "master" }) {
  const filters: FilterDef<AdminRow>[] = [
    { key: "org", label: "Organisasi", options: organizations.map((o) => ({ value: o.id, label: o.organization_name })), match: (r, v) => r.organization_id === v },
    { key: "type", label: "Kategori", options: [{ value: "CAT", label: "CAT" }, { value: "Additional", label: "Additional" }, { value: "-", label: "Tanpa kategori" }], match: (r, v) => (v === "-" ? !r.task_type : r.task_type === v) },
    { key: "status", label: "Status", options: STAGE_ORDER.map((s) => ({ value: s, label: STAGE_META[s].label })), match: (r, v) => sopStage(r.progress) === v },
  ];
  if (mode === "master") filters.push({ key: "active", label: "Arsip", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Diarsipkan" }], match: (r, v) => r.is_active === (v === "1") });

  const columns: Column<AdminRow>[] = [
    { key: "no", header: "Task No", cell: (r) => <span className="font-medium tabular">{r.task_number}</span>, sortValue: (r) => r.organization_sort * 1000 + r.task_seq },
    { key: "org", header: "Organization", cell: (r) => r.organization_name, sortValue: (r) => r.organization_name },
    {
      key: "name",
      header: "SOP Name",
      cell: (r) => (
        <div className="min-w-[13rem] max-w-[22rem]">
          <Link href={`/admin/sop/edit/?id=${r.id}`} className="font-medium text-ink hover:underline">{r.sop_name}</Link>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {!r.is_active ? <Badge tone="warn">Diarsipkan</Badge> : null}
            {r.overdue ? <Badge tone="bad">Overdue</Badge> : null}
            {r.progress_source === "legacy" ? <Badge tone="neutral" title="Progres dari kolom M/N/O workbook">Workbook</Badge> : null}
          </div>
        </div>
      ),
      sortValue: (r) => r.sop_name,
    },
    { key: "cat", header: "Kategori", cell: (r) => <CategoryBadge type={r.task_type} />, sortValue: (r) => r.task_type ?? "~" },
  ];
  if (mode === "master") {
    columns.push(
      { key: "cls", header: "New/Rev", cell: (r) => r.document_classification ?? <Badge tone="warn" title="Belum diisi – buka Edit lalu pilih New atau Revision">Belum diisi</Badge>, sortValue: (r) => r.document_classification ?? "~" },
      { key: "crit", header: "Critical", cell: (r) => (r.critical ? <Badge tone="bad">Critical</Badge> : <span className="whitespace-nowrap text-xs text-ink-3">Non-Critical</span>), sortValue: (r) => (r.critical ? 0 : 1) },
      { key: "start", header: "Start", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateId(r.start_date)}</span>, sortValue: (r) => r.start_date },
      { key: "end", header: "End", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateId(r.end_date)}</span>, sortValue: (r) => r.end_date },
      { key: "prog", header: "Progress", cell: (r) => <span className="tabular">{r.progress.value === null ? "—" : fmtPct(r.progress.value, 0)}</span>, sortValue: (r) => r.progress.value },
      { key: "status", header: "Status", cell: (r) => <StageBadge progress={r.progress} />, sortValue: (r) => STAGE_ORDER.indexOf(sopStage(r.progress)) },
      {
        key: "act",
        header: "",
        cell: (r) => (
          <div className="flex gap-1.5">
            <Link href={`/admin/sop/edit/?id=${r.id}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-canvas"><Pencil className="size-3" />Edit</Link>
            <ArchiveButton row={r} />
          </div>
        ),
      },
    );
  } else {
    columns.push(
      { key: "end", header: "End Date", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateId(r.end_date)}</span>, sortValue: (r) => r.end_date },
      { key: "status", header: "Status saat ini", cell: (r) => <StageBadge progress={r.progress} />, sortValue: (r) => STAGE_ORDER.indexOf(sopStage(r.progress)) },
      { key: "upd", header: "Update progres", cell: (r) => <QuickProgress key={`${r.id}-${r.updated_at}`} row={r} /> },
    );
  }
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${r.task_number} ${r.sop_name} ${r.organization_name} ${r.remark ?? ""}`}
      filters={filters}
      initialSort={{ key: "no", dir: "asc" }}
      pageSize={25}
      rowClassName={(r) => (r.is_active ? undefined : "bg-amber-50/40")}
    />
  );
}
