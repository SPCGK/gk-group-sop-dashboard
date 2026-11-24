"use client";
import { useApp } from "@/components/app-provider";
import { AdminUsers, SettingsForm } from "@/components/admin/settings-forms";
import { Card, CardHeader, PageTitle } from "@/components/ui";

export default function SettingsPage() {
  const { adminData, auth } = useApp();
  if (!adminData) return null;
  return (
    <div className="max-w-4xl space-y-5">
      <PageTitle title="System Settings" />
      <Card>
        <CardHeader title="Perhitungan & integrasi" />
        <SettingsForm data={adminData} />
      </Card>
      <AdminUsers admins={adminData.admins} selfEmail={auth.email ?? ""} />
    </div>
  );
}
