"use client";
import { useAdminEngine } from "@/components/app-provider";
import { OrganizationManager } from "@/components/admin/organization-manager";
import { PageTitle } from "@/components/ui";

export default function OrganizationsPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  const rows = eng.allOrganizations.map((o) => ({ ...o, sopCount: eng.allTasks.filter((t) => t.organization_id === o.id && t.is_active).length }));
  return (
    <>
      <PageTitle title="Organization Management" description="Divisi / Departemen / Business Unit. Organisasi tidak dihapus – gunakan Nonaktifkan agar riwayat tetap utuh." />
      <OrganizationManager rows={rows} />
    </>
  );
}
