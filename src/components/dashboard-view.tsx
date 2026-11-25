import { CheckCircle2, CircleDashed, CircleDot, FileStack, Layers, PauseCircle, Sparkles, Target } from "lucide-react";
import type { EngineResult } from "@/lib/engine";
import { fmtPct } from "@/lib/engine";
import { formatDateId } from "@/lib/engine/dates";
import {
  CatVsAdditionalChart,
  CompletionTrendChart,
  MonthlyTargetVsActualChart,
  ProgressByOrganizationChart,
  StatusDistributionChart,
} from "./charts";
import { OrgPerformanceTable, SopOverviewTable } from "./tables";
import { Card, CardHeader } from "./ui";

function Kpi({ label, value, hint, icon: Icon, tone = "ink" }: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ className?: string }>; tone?: "ink" | "ok" | "info" | "warn" | "cat" | "additional" | "neutral" }) {
  const toneCls = { ink: "text-ink", ok: "text-ok", info: "text-info", warn: "text-warn", cat: "text-cat", additional: "text-additional", neutral: "text-neutral" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-3">{label}</p>
        <Icon className={`size-4 ${toneCls}`} aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </Card>
  );
}

function OverallHero({ result }: { result: EngineResult }) {
  const o = result.overall;
  const catContrib = o.catContribution ?? 0;
  const addContrib = o.additionalContribution ?? 0;
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-brand" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <Target className="size-4 text-brand-strong" aria-hidden /> Overall Achievement
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-ink tabular">{fmtPct(o.overallAchievement)}</p>
          {o.overallNote && <p className="text-xs text-warn">{o.overallNote}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="text-ink-3">Overall % CAT</dt>
          <dd className="text-right font-semibold tabular">{fmtPct(o.pctCat)}</dd>
          <dt className="text-ink-3">Overall % Additional</dt>
          <dd className="text-right font-semibold tabular">{fmtPct(o.pctAdditional)}</dd>
        </dl>
      </div>
      <div className="mt-5">
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`Kontribusi CAT ${fmtPct(catContrib)}, Additional ${fmtPct(addContrib)}`}>
          <div className="h-full rounded-l-full bg-cat" style={{ width: `${Math.min(100, catContrib * 100)}%` }} />
          <div className="h-full bg-additional" style={{ width: `${Math.min(100, addContrib * 100)}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-cat" aria-hidden />Kontribusi CAT {fmtPct(catContrib)}</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-additional" aria-hidden />Kontribusi Additional {fmtPct(addContrib)}</span>
        </div>
      </div>
    </Card>
  );
}

export function DashboardView({ result, today, adminLinks = false }: { result: EngineResult; today: string; adminLinks?: boolean }) {
  const k = result.kpi;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">SOP Management &amp; Performance {result.year}</h1>
          <p className="mt-1 text-sm text-ink-3">Data per {formatDateId(today)} · dihitung langsung dari database</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <OverallHero result={result} />
        <Card>
          <CardHeader title="CAT vs Additional" description="Rata-rata persentase divisi yang memiliki data" />
          <div className="px-2 py-3"><CatVsAdditionalChart overall={result.overall} /></div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Total SOP" value={k.totalSop} hint={k.uncategorized ? `${k.uncategorized} tanpa kategori` : undefined} icon={FileStack} />
        <Kpi label="Total CAT" value={k.totalCat} icon={Layers} tone="cat" />
        <Kpi label="Total Additional" value={k.totalAdditional} icon={Sparkles} tone="additional" />
        <Kpi label="Overall % CAT" value={fmtPct(result.overall.pctCat)} icon={Target} tone="cat" />
        <Kpi label="Overall % Additional" value={fmtPct(result.overall.pctAdditional)} icon={Target} tone="additional" />
        <Kpi label="Completed" value={k.completed} icon={CheckCircle2} tone="ok" />
        <Kpi label="In Progress" value={k.inProgress} icon={CircleDot} tone="info" />
        <Kpi label="Not Started" value={k.notStarted + k.notInput} hint={k.notInput ? `${k.notInput} belum diinput progresnya` : undefined} icon={CircleDashed} tone="neutral" />
        <Kpi label="Hold" value={k.hold} hint="Dikecualikan dari pencapaian" icon={PauseCircle} tone="warn" />
        <Kpi label="Overdue" value={k.overdue} hint="Lewat End Date, belum selesai" icon={CircleDashed} tone={k.overdue ? "warn" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly Target vs Actual" description="Total Achievement bulanan dibanding target" />
          <div className="px-2 py-3"><MonthlyTargetVsActualChart data={result.monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="SOP Completion Trend" description="Input SOP Completion & SOP Awareness per bulan" />
          <div className="px-2 py-3"><CompletionTrendChart data={result.monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="Progress by Organization" description="% CAT dan % Additional per divisi (N/A tidak ditampilkan)" />
          <div className="px-2 py-3"><ProgressByOrganizationChart organizations={result.organizations} /></div>
        </Card>
        <Card>
          <CardHeader title="SOP Status Distribution" description="Belum diinput = SOP hasil migrasi tanpa nilai progres" />
          <div className="px-2 py-3"><StatusDistributionChart kpi={result.kpi} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Organization Performance" description="Angka dalam kurung pada Not Started = SOP yang belum diinput progresnya" />
        <OrgPerformanceTable rows={result.organizations} />
      </Card>

      <Card>
        <CardHeader title="SOP Overview" description="Seluruh SOP aktif. Gunakan pencarian, filter, dan klik judul kolom untuk mengurutkan." />
        <SopOverviewTable result={result} adminLinks={adminLinks} />
      </Card>
    </div>
  );
}
