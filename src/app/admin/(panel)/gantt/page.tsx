"use client";
import { useAdminEngine } from "@/components/app-provider";
import { GanttChart } from "@/components/gantt-chart";
import { Card, PageTitle } from "@/components/ui";

export default function AdminGanttPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  const { result, input } = eng;
  return (
    <>
      <PageTitle title="Gantt Chart" description="Ubah Start/End Date melalui halaman SOP – posisi bar langsung diperbarui. Ketuk SOP untuk membuka detail dan tautan edit." />
      <Card>
        <GanttChart tasks={result.tasks} organizations={input.organizations} holidays={input.holidays} projectStart={input.settings.project.start} projectEnd={input.settings.project.end} today={input.today} adminLinks />
      </Card>
    </>
  );
}
