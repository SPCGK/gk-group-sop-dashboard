"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PlusCircle, Upload } from "lucide-react";
import { runEngine } from "@/lib/engine";
import { useAdminEngine } from "../app-provider";
import { AdminSopTable } from "./admin-sop-table";
import { Alert, buttonClass, Card, PageTitle } from "../ui";

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
      <Card>
        <AdminSopTable rows={rows} organizations={eng.allOrganizations} mode="master" />
      </Card>
    </>
  );
}
