"use client";

import Link from "next/link";
import { AlertTriangle, Flame, Pencil } from "lucide-react";
import type { EngineResult, EnrichedTask, OrgPerformance } from "@/lib/engine";
import { fmtPct } from "@/lib/engine";
import { formatDateId } from "@/lib/engine/dates";
import { DataTable, type Column, type FilterDef } from "./data-table";
import { CategoryBadge, StatusBadge, STATUS_META } from "./status";
import { Badge, ProgressBar } from "./ui";

export function OrgPerformanceTable({ rows }: { rows: OrgPerformance[] }) {
  const columns: Column<OrgPerformance>[] = [
    { key: "org", header: "Organization", cell: (r) => <span className="font-medium text-ink">{r.organization.organization_name}</span>, sortValue: (r) => r.organization.sort_order },
    { key: "total", header: "Total SOP", cell: (r) => r.totalSop, sortValue: (r) => r.totalSop, className: "tabular text-right", headerClassName: "text-right" },
    { key: "cat", header: "CAT", cell: (r) => r.cat, sortValue: (r) => r.cat, className: "tabular text-right", headerClassName: "text-right" },
    { key: "add", header: "Additional", cell: (r) => r.additional, sortValue: (r) => r.additional, className: "tabular text-right", headerClassName: "text-right" },
    {
      key: "ns",
      header: "Not Started",
      cell: (r) => (
        <span title={r.counts.notInput ? `${r.counts.notInput} SOP belum diinput progresnya` : undefined}>
          {r.counts.notStarted}
          {r.counts.notInput ? <span className="text-ink-3"> (+{r.counts.notInput})</span> : null}
        </span>
      ),
      sortValue: (r) => r.counts.notStarted + r.counts.notInput,
      className: "tabular text-right",
      headerClassName: "text-right",
    },
    { key: "ip", header: "In Progress", cell: (r) => r.counts.inProgress, sortValue: (r) => r.counts.inProgress, className: "tabular text-right", headerClassName: "text-right" },
    { key: "cp", header: "Completed", cell: (r) => r.counts.completed, sortValue: (r) => r.counts.completed, className: "tabular text-right", headerClassName: "text-right" },
    {
      key: "pcat",
      header: "% CAT",
      cell: (r) => <PctCell value={r.pctCat} />,
      sortValue: (r) => r.pctCat,
      className: "tabular text-right w-32",
      headerClassName: "text-right",
    },
    {
      key: "padd",
      header: "% Additional",
      cell: (r) => <PctCell value={r.pctAdditional} />,
      sortValue: (r) => r.pctAdditional,
      className: "tabular text-right w-32",
      headerClassName: "text-right",
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.organization.id}
      searchText={(r) => `${r.organization.organization_name} ${r.organization.organization_code ?? ""}`}
      initialSort={{ key: "org", dir: "asc" }}
      pageSize={15}
    />
  );
}

function PctCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-3" title="Tidak ada SOP pada kategori ini">N/A</span>;
  return (
    <div className="ml-auto flex max-w-[7rem] flex-col items-end gap-1">
      <span className="font-semibold text-ink">{fmtPct(value)}</span>
      <ProgressBar value={value} tone="brand" />
    </div>
  );
}

export function SopOverviewTable({ result, adminLinks = false }: { result: EngineResult; adminLinks?: boolean }) {
  const orgOptions = result.organizations.map((o) => ({ value: o.organization.id, label: o.organization.organization_name }));
  const filters: FilterDef<EnrichedTask>[] = [
    { key: "org", label: "Organisasi", options: orgOptions, match: (r, v) => r.organization_id === v },
    { key: "type", label: "Kategori", options: [{ value: "CAT", label: "CAT" }, { value: "Additional", label: "Additional" }, { value: "-", label: "Tanpa kategori" }], match: (r, v) => (v === "-" ? !r.task_type : r.task_type === v) },
    {
      key: "status",
      label: "Status",
      options: (["Not Started", "Not Input", "In Progress", "Completed", "Hold"] as const).map((s) => ({ value: s, label: STATUS_META[s].label })),
      match: (r, v) => r.progress.status === v,
    },
    { key: "crit", label: "Critical", options: [{ value: "1", label: "Critical" }, { value: "0", label: "Non-Critical" }], match: (r, v) => r.critical === (v === "1") },
    { key: "flag", label: "Jadwal", options: [{ value: "overdue", label: "Overdue" }, { value: "none", label: "Tanpa jadwal" }], match: (r, v) => (v === "overdue" ? r.overdue : !r.start_date || !r.end_date) },
  ];
  const columns: Column<EnrichedTask>[] = [
    { key: "no", header: "Task No", cell: (r) => <span className="tabular font-medium">{r.task_number}</span>, sortValue: (r) => r.organization_sort * 1000 + r.task_seq },
    { key: "org", header: "Organization", cell: (r) => r.organization_name, sortValue: (r) => r.organization_name },
    {
      key: "name",
      header: "SOP Name",
      cell: (r) => (
        <div className="min-w-[14rem] max-w-[22rem]">
          <p className="font-medium text-ink">{r.sop_name}</p>
          {r.overdue ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-bad"><AlertTriangle className="size-3" aria-hidden /> Overdue</p>
          ) : null}
        </div>
      ),
      sortValue: (r) => r.sop_name,
    },
    { key: "cat", header: "Category", cell: (r) => <CategoryBadge type={r.task_type} />, sortValue: (r) => r.task_type ?? "~" },
    { key: "cls", header: "New/Revision", cell: (r) => r.document_classification ?? <span className="text-ink-3">—</span>, sortValue: (r) => r.document_classification ?? "~" },
    { key: "start", header: "Start Date", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateId(r.start_date)}</span>, sortValue: (r) => r.start_date },
    { key: "end", header: "End Date", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateId(r.end_date)}</span>, sortValue: (r) => r.end_date },
    { key: "md", header: "Mandays", cell: (r) => (r.mandays ?? "—"), sortValue: (r) => r.mandays, className: "tabular text-right", headerClassName: "text-right" },
    {
      key: "prog",
      header: "Progress",
      cell: (r) => (
        <div className="w-24">
          <span className="text-xs font-semibold tabular">{r.progress.value === null ? "—" : fmtPct(r.progress.value, 0)}</span>
          <ProgressBar value={r.progress.value} tone={r.progress.status === "Completed" ? "ok" : "info"} className="mt-1" />
        </div>
      ),
      sortValue: (r) => r.progress.value,
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.progress.status} />, sortValue: (r) => r.progress.status },
    {
      key: "crit",
      header: "Critical",
      cell: (r) => (r.critical ? <Badge tone="bad"><Flame className="size-3" aria-hidden />Critical</Badge> : <span className="text-xs text-ink-3">Non-Critical</span>),
      sortValue: (r) => (r.critical ? 0 : 1),
    },
    { key: "remark", header: "Remark", cell: (r) => <span className="line-clamp-2 max-w-[14rem] text-xs text-ink-2">{r.remark ?? ""}</span> },
  ];
  if (adminLinks) {
    columns.push({
      key: "act",
      header: "",
      cell: (r) => (
        <Link href={`/admin/sop/edit/?id=${r.id}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-canvas">
          <Pencil className="size-3" aria-hidden /> Kelola
        </Link>
      ),
    });
  }
  return (
    <DataTable
      rows={result.tasks}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${r.task_number} ${r.sop_name} ${r.organization_name} ${r.remark ?? ""}`}
      filters={filters}
      initialSort={{ key: "no", dir: "asc" }}
      pageSize={15}
    />
  );
}
