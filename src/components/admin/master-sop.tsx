"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, GanttChartSquare, PlusCircle, Upload } from "lucide-react";
import { GanttChart } from "../gantt-chart";
import { runEngine } from "@/lib/engine";
import { useAdminEngine } from "../app-provider";
import { AdminSopTable } from "./admin-sop-table";
import { Alert, buttonClass, Card, PageTitle } from "../ui";

function GanttPanel() {
  const eng = useAdminEngine();
  const [open, setOpen] = useState(true);
  if (!eng) return null;
  return (
    <Card className="mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-5 py-3 text-left" aria-expanded={open}>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <GanttChartSquare className="size-4 text-brand-strong" aria-hidden />
        <span className="text-sm font-semibold">Gantt Chart</span>
        <span className="text-xs text-ink-3">– klik bar/nama SOP lalu “Edit” untuk mengatur jadwal; di halaman Edit, Gantt pratinjau ikut bergerak saat tanggal diubah.</span>
      </button>
      {open ? (
        <GanttChart
          tasks={eng.result.tasks}
          organizations={eng.input.organizations}
          holidays={eng.input.holidays}
          projectStart={eng.input.settings.project.start}
          projectEnd={eng.input.settings.project.end}
          today={eng.input.today}
          maxHeight="50vh"
          adminLinks
        />
      ) : null}
    </Card>
  );
}

export function MasterSop() {
  const sp = useSearchParams();
  const eng = useAdminEngine();
  if (!eng) return null;
  // Run the engine over every SOP (archived included) only to enrich rows for the table.
  const all = runEngine({ ...eng.input, organizations: eng.allOrganizations, tasks: eng.allTasks.map((t) => ({ ...t, is_active: true })) });
  const activeById = new Map(eng.allTasks.map((t) => [t.id, t.is_active]));
  const rows = all.tasks.map((t) => ({ ...t, is_active: activeById.get(t.id) ?? true }));
  return (
    <>
      <PageTitle
        title="Master SOP"
        description="Seluruh SOP termasuk yang diarsipkan. Tambah, edit, arsipkan, atau hapus SOP."
        action={
          <div className="flex gap-2">
            <Link href="/admin/master-sop/import/" className={buttonClass("outline", "sm")}><Upload className="size-4" />Import (Google Sheets / CSV)</Link>
            <Link href="/admin/sop/new/" className={buttonClass("secondary", "sm")}><PlusCircle className="size-4" />Add New SOP</Link>
          </div>
        }
      />
      {sp.get("deleted") ? <div className="mb-4"><Alert tone="ok">SOP dihapus permanen.</Alert></div> : null}
      <GanttPanel />
      <Card>
        <AdminSopTable rows={rows} organizations={eng.allOrganizations} mode="master" />
      </Card>
    </>
  );
}
