"use client";
import { useAdminEngine } from "@/components/app-provider";
import { MonthlyEditor } from "@/components/admin/monthly-editor";
import { MonthlyView } from "@/components/monthly-view";
import { Card, CardHeader, PageTitle } from "@/components/ui";

export default function AdminMonthlyPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  return (
    <div className="space-y-5">
      <PageTitle title="Monthly Achievement" description="Atur target, bobot, serta input SOP Completion dan SOP Awareness per bulan." />
      <Card>
        <CardHeader title={`Input ${eng.result.year}`} />
        <MonthlyEditor year={eng.result.year} rows={eng.result.monthly} />
      </Card>
      <MonthlyView result={eng.result} />
    </div>
  );
}
