import type { Metadata } from "next";
import { ImportWizard } from "@/components/admin/import-wizard";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Import Data" };

export default function ImportPage() {
  return (
    <div className="max-w-6xl">
      <PageTitle title="Import dari SPC Schedule" description="Ambil data → validasi → preview → migrasi. Hanya baris tervalidasi yang dimasukkan ke database. Google Sheets sumber tidak pernah diubah." />
      <ImportWizard />
    </div>
  );
}
