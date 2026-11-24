"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAdminEngine, useApp } from "../app-provider";
import { DangerZone } from "./danger-zone";
import { ProgressForm } from "./progress-form";
import { SopForm } from "./sop-form";
import { CategoryBadge, StatusBadge } from "../status";
import { Alert, Badge, Card, CardHeader } from "../ui";
import { fmtPct, runEngine, sopProgress, type WorkflowStatus } from "@/lib/engine";
import { formatDateId } from "@/lib/engine/dates";
import type { HistoryRow } from "@/lib/data-model";

export function SopDetail() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const eng = useAdminEngine();
  const { call, adminData } = useApp();
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    if (!id) return;
    call<HistoryRow[]>("taskHistory", { id }, { refresh: false }).then((r) => setHistory(r.ok ? r.data ?? [] : []));
  }, [id, call, adminData]);

  if (!eng) return null;
  const task = eng.allTasks.find((t) => t.id === id);
  if (!task) return <Alert tone="warn" title="SOP tidak ditemukan">SOP mungkin sudah dihapus. <Link href="/admin/master-sop/" className="underline">Kembali ke Master SOP</Link></Alert>;
  const r = runEngine({ ...eng.input, organizations: eng.allOrganizations, tasks: [{ ...task, is_active: true }] });
  const et = r.tasks[0];
  const prog = sopProgress(task);
  const legacyNote =
    task.progress_source === "legacy"
      ? `Progres saat ini berasal dari data workbook (rata-rata M/N/O: ${prog.value === null ? "belum diinput" : fmtPct(prog.value, 0)}). Menyimpan progres di sini akan beralih ke input progres tunggal; nilai M/N/O tetap tersimpan.`
      : undefined;
  const status: WorkflowStatus | null = prog.status === "Not Input" ? null : (prog.status as WorkflowStatus);
  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/sop/" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> SOP Management</Link>
      {sp.get("created") ? <Alert tone="ok" title="SOP baru tersimpan">Task Number {task.task_number} dibuat otomatis. SOP sudah tampil di Dashboard dan Gantt Chart.</Alert> : null}
      <div>
        <p className="text-sm text-ink-3">Task {task.task_number} · {et.organization_name}</p>
        <h1 className="text-xl font-semibold sm:text-2xl">{task.sop_name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <CategoryBadge type={task.task_type} />
          <StatusBadge status={prog.status} />
          {task.critical ? <Badge tone="bad">Critical</Badge> : null}
          {!task.is_active ? <Badge tone="warn">Diarsipkan</Badge> : null}
          {et.overdue ? <Badge tone="bad">Overdue</Badge> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Progress", prog.value === null ? "—" : fmtPct(prog.value, 0)],
          ["Mandays", et.mandays ?? "—"],
          ["Actual Days", et.actual_days ?? "—"],
          ["Man Days", et.man_days ?? "—"],
          ["Jadwal", `${formatDateId(task.start_date)} – ${formatDateId(task.end_date)}`],
        ].map(([l, v]) => (
          <Card key={String(l)} className="p-3" data-metric={String(l)}>
            <p className="text-xs text-ink-3">{l}</p>
            <p className="mt-1 text-sm font-semibold tabular">{v}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Data SOP" description="Perubahan tanggal langsung memperbarui Gantt Chart dan perhitungan hari kerja." />
          <div className="p-5"><SopForm organizations={eng.allOrganizations} task={task} /></div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Update Progres" description="Not Started = 0% · In Progress = 1–99% · Completed = 100% · Hold dikecualikan" />
            <div className="p-5">
              <ProgressForm id={task.id} status={status} percent={prog.value === null ? null : prog.value * 100} actualEnd={task.actual_end_date} legacyNote={legacyNote} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Riwayat Progres" />
            <ul className="max-h-72 divide-y divide-line overflow-y-auto text-xs">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-5 py-2">
                  <span className="tabular text-ink-3">{new Date(h.changed_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</span>
                  <span className="ml-auto font-medium">
                    {h.progress_source === "legacy"
                      ? `M/N/O: ${[h.legacy_m, h.legacy_n, h.legacy_o].map((v) => (v === null ? "–" : `${Math.round(Number(v) * 100)}%`)).join(" / ")}`
                      : `${h.workflow_status ?? "—"} · ${h.progress_percentage === null ? "—" : `${Number(h.progress_percentage)}%`}`}
                  </span>
                  <span className="hidden text-ink-3 sm:inline">{h.changed_by_email ?? "migrasi"}</span>
                </li>
              ))}
              {history && !history.length ? <li className="px-5 py-4 text-ink-3">Belum ada riwayat.</li> : null}
              {!history ? <li className="px-5 py-4 text-ink-3">Memuat…</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Arsip / Hapus" />
            <div className="p-5"><DangerZone id={task.id} taskNumber={task.task_number} active={task.is_active} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
