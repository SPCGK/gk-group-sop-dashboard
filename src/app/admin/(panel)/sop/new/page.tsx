"use client";
import { useAdminEngine } from "@/components/app-provider";
import { SopForm } from "@/components/admin/sop-form";
import { Card, PageTitle } from "@/components/ui";

export default function NewSopPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Add New SOP" description="Task Number dibuat otomatis. SOP baru dimulai dengan status Not Started (0%) dan langsung muncul di Dashboard serta Gantt Chart." />
      <Card className="p-5">
        <SopForm organizations={eng.allOrganizations} />
      </Card>
    </div>
  );
}
