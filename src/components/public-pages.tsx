"use client";

import { useApp } from "./app-provider";
import { DashboardView } from "./dashboard-view";
import { GanttChart } from "./gantt-chart";
import { HolidayTable } from "./holiday-list";
import { LoadError, Loading } from "./data-state";
import { MonthlyView } from "./monthly-view";
import { Card, CardHeader, PageTitle } from "./ui";

function useLoaded() {
  const { result, input, publicError, refreshPublic } = useApp();
  if (publicError && !result) return { node: <LoadError message={publicError} onRetry={refreshPublic} /> };
  if (!result || !input) return { node: <Loading /> };
  return { result, input };
}

export function PublicDashboard() {
  const s = useLoaded();
  if (!s.result) return s.node;
  return <DashboardView result={s.result} weights={s.input.settings.weights} today={s.input.today} />;
}

export function PublicGantt() {
  const s = useLoaded();
  if (!s.result) return s.node;
  return (
    <>
      <PageTitle title="Gantt Chart" description="Jadwal SOP per organisasi. Ketuk bar atau nama SOP untuk melihat detail." />
      <Card>
        <GanttChart tasks={s.result.tasks} organizations={s.input.organizations} holidays={s.input.holidays} projectStart={s.input.settings.project.start} projectEnd={s.input.settings.project.end} today={s.input.today} />
      </Card>
    </>
  );
}

export function PublicMonthly() {
  const s = useLoaded();
  if (!s.result) return s.node;
  return (
    <>
      <PageTitle title="Monthly Achievement" description="Target bulanan, SOP Completion, SOP Awareness, dan variance." />
      <MonthlyView result={s.result} />
    </>
  );
}

export function PublicHolidays() {
  const s = useLoaded();
  if (!s.result) return s.node;
  const nonWorking = s.input.holidays.filter((h) => h.exclude_from_working_days).length;
  return (
    <>
      <PageTitle title="Kalender Hari Libur" description="Sumber tunggal hari non-kerja untuk perhitungan Mandays, Actual Days, dan Gantt Chart." />
      <Card>
        <CardHeader title={`${s.input.holidays.length} tanggal · ${nonWorking} dihitung sebagai hari non-kerja`} description="Sabtu dan Minggu selalu non-kerja. Cuti bersama mengikuti keputusan Administrator." />
        <HolidayTable holidays={[...s.input.holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))} />
      </Card>
    </>
  );
}
