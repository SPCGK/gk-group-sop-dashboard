"use client";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useAdminEngine } from "@/components/app-provider";
import { AdminSopTable } from "@/components/admin/admin-sop-table";
import { buttonClass, Card, PageTitle } from "@/components/ui";

export default function SopManagementPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  return (
    <>
      <PageTitle
        title="SOP Management"
        description="Perbarui status dan progres SOP secara cepat. Perubahan langsung dihitung ulang di Dashboard, Division Performance, dan Gantt Chart."
        action={<Link href="/admin/sop/new/" className={buttonClass("secondary", "sm")}><PlusCircle className="size-4" />Add New SOP</Link>}
      />
      <Card>
        <AdminSopTable rows={eng.result.tasks} organizations={eng.input.organizations} mode="progress" />
      </Card>
    </>
  );
}
