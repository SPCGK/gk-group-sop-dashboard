"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { CloudDownload, FileUp } from "lucide-react";
import { formatDateId } from "@/lib/engine/dates";
import { normalizeName, parseSpcGrid, previewProgress, type Grid, type ParseResult, type ParsedTask } from "@/lib/import/spc-parser";
import { useApp } from "../app-provider";
import { Alert, Badge, Button, Card, CardHeader, cn } from "../ui";

type Mode = "insert-only" | "upsert-legacy";
interface PlanRow { source_row: number; task_number: string; organization_name: string; sop_name: string; action: "insert" | "update" | "skip" | "invalid"; reason?: string; task: ParsedTask }
interface ImportReport { inserted: number; updated: number; skipped: number; failed: { row: number; task: string; error: string }[]; organizationsCreated: number; monthlyUpdated: boolean; message: string }

export function ImportWizard() {
  const { call, adminData } = useApp();
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [mode, setMode] = useState<Mode>("insert-only");
  const [includeMonthly, setIncludeMonthly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState(false);
  const sheetName = adminData?.settings.source?.sheet_name ?? "SPC Schedule 2027";

  const load = (grid: Grid, label: string) => {
    const p = parseSpcGrid(grid);
    setParse(p);
    setSourceLabel(label);
    setReport(null);
    setError(p.tasks.length === 0 && p.issues.some((i) => i.level === "error") ? p.issues[0].message : null);
  };

  const fromGoogle = async () => {
    setPending(true);
    setError(null);
    const r = await call<Grid>("fetchSource", {}, { refresh: false });
    setPending(false);
    if (r.ok && r.data) load(r.data, `Google Sheets – ${sheetName}`);
    else setError(r.message ?? "Gagal membaca Google Sheets sumber.");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return setError("File terlalu besar (maks 2 MB).");
    const text = await f.text();
    load(Papa.parse<string[]>(text, { skipEmptyLines: false }).data, `CSV – ${f.name}`);
  };

  // Plan against the current database (admin data).
  const plan = useMemo<PlanRow[]>(() => {
    if (!parse || !adminData) return [];
    const orgByName = new Map(adminData.organizations.map((o) => [normalizeName(o.organization_name), o]));
    return parse.tasks.map((t) => {
      const base = { source_row: t.source_row, task_number: t.task_number, organization_name: t.organization_name, sop_name: t.sop_name, task: t };
      if (!t.valid) return { ...base, action: "invalid" as const, reason: parse.issues.filter((i) => i.row === t.source_row && i.level === "error").map((i) => i.message).join("; ") };
      const org = orgByName.get(normalizeName(t.organization_name));
      const existing = org ? adminData.tasks.find((x) => x.is_active && x.organization_id === org.id && normalizeName(x.sop_name) === normalizeName(t.sop_name)) : undefined;
      if (!existing) return { ...base, action: "insert" as const };
      if (mode === "insert-only") return { ...base, action: "skip" as const, reason: "Sudah ada di database" };
      if (existing.progress_source !== "legacy") return { ...base, action: "skip" as const, reason: "Progres sudah dikelola di aplikasi – tidak ditimpa" };
      return { ...base, action: "update" as const };
    });
  }, [parse, adminData, mode]);

  const newOrganizations = useMemo(() => {
    if (!parse || !adminData) return [];
    const names = new Set(adminData.organizations.map((o) => normalizeName(o.organization_name)));
    return parse.organizations.filter((o) => !names.has(normalizeName(o.organization_name))).map((o) => o.organization_name);
  }, [parse, adminData]);

  const counts = plan.reduce((acc, p) => ({ ...acc, [p.action]: (acc[p.action] ?? 0) + 1 }), {} as Record<string, number>);

  const commit = async () => {
    if (!parse) return;
    setPending(true);
    const tasks = plan.filter((p) => p.action === "insert" || p.action === "update").map((p) => p.task);
    const r = await call<ImportReport>("importCommit", { mode, includeMonthly, organizations: parse.organizations, tasks, monthly: parse.monthly });
    setPending(false);
    if (r.ok && r.data) setReport(r.data);
    else setError(r.message ?? "Impor gagal.");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold"><CloudDownload className="size-4" /> Langsung dari Google Sheets</p>
          <p className="mt-1 text-sm text-ink-3">Apps Script membaca sheet <strong>{sheetName}</strong> secara read-only dengan akun pemilik. Sheet sumber tidak diubah.</p>
          <Button className="mt-4" variant="primary" disabled={pending} onClick={fromGoogle}>Ambil data &amp; preview</Button>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold"><FileUp className="size-4" /> Impor CSV (alternatif)</p>
          <p className="mt-1 text-sm text-ink-3">Di Google Sheets buka sheet <strong>{sheetName}</strong> → File → Download → CSV, lalu pilih file di sini.</p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-3 px-4 py-2 text-sm hover:bg-canvas">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={pending} />
            Pilih file CSV…
          </label>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap gap-6 text-sm">
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-ink-2">Mode</legend>
            <label className="mr-4 inline-flex items-center gap-2"><input type="radio" checked={mode === "insert-only"} onChange={() => setMode("insert-only")} /> Tambah SOP baru saja</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={mode === "upsert-legacy"} onChange={() => setMode("upsert-legacy")} /> Tambah &amp; perbarui SOP hasil migrasi</label>
            <p className="mt-1 text-xs text-ink-3">SOP yang progresnya sudah dikelola di aplikasi tidak pernah ditimpa.</p>
          </fieldset>
          <label className="inline-flex items-center gap-2 self-center"><input type="checkbox" checked={includeMonthly} onChange={(e) => setIncludeMonthly(e.target.checked)} /> Sertakan target &amp; input Monthly Achievement</label>
        </div>
      </Card>

      {pending ? <Alert tone="info">Memproses…</Alert> : null}
      {error ? <Alert tone="bad" title="Tidak dapat melanjutkan">{error}</Alert> : null}

      {parse && parse.tasks.length > 0 ? (
        <Card>
          <CardHeader
            title="Preview migrasi"
            description={`${sourceLabel} · ${parse.organizations.length} organisasi · ${plan.length} SOP terbaca · ${parse.issues.length} catatan validasi`}
            action={
              <Button variant="secondary" disabled={pending || ((counts.insert ?? 0) + (counts.update ?? 0) === 0 && !includeMonthly)} onClick={commit}>
                Migrasikan data tervalidasi
              </Button>
            }
          />
          <div className="flex flex-wrap gap-2 px-5 py-3 text-xs">
            <Badge tone="ok">Baru: {counts.insert ?? 0}</Badge>
            <Badge tone="info">Diperbarui: {counts.update ?? 0}</Badge>
            <Badge tone="neutral">Dilewati: {counts.skip ?? 0}</Badge>
            <Badge tone="bad">Tidak valid: {counts.invalid ?? 0}</Badge>
            {newOrganizations.length ? <Badge tone="brand">Organisasi baru: {newOrganizations.join(", ")}</Badge> : null}
          </div>
          <div className="max-h-[28rem] overflow-auto border-t border-line">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="sticky top-0 bg-canvas text-ink-3">
                <tr>{["Baris", "Task", "Organisasi", "Nama SOP", "Kategori", "Start", "End", "M/N/O", "Progres", "Aksi"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plan.map((p) => {
                  const pr = previewProgress(p.task);
                  return (
                    <tr key={p.source_row} className={cn(p.action === "invalid" && "bg-red-50")}>
                      <td className="px-3 py-1.5 tabular">{p.source_row}</td>
                      <td className="px-3 py-1.5 tabular">{p.task_number}</td>
                      <td className="px-3 py-1.5">{p.organization_name}</td>
                      <td className="px-3 py-1.5">{p.sop_name}</td>
                      <td className="px-3 py-1.5">{p.task.task_type ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular">{formatDateId(p.task.start_date)}</td>
                      <td className="px-3 py-1.5 tabular">{formatDateId(p.task.end_date)}</td>
                      <td className="px-3 py-1.5 tabular">{[p.task.legacy_m, p.task.legacy_n, p.task.legacy_o].map((v) => (v === null ? "–" : `${Math.round(v * 100)}%`)).join(" / ")}</td>
                      <td className="px-3 py-1.5 tabular">{pr === null ? "belum diinput" : `${Math.round(pr * 100)}%`}</td>
                      <td className="px-3 py-1.5">
                        <Badge tone={p.action === "insert" ? "ok" : p.action === "update" ? "info" : p.action === "invalid" ? "bad" : "neutral"}>{p.action}</Badge>
                        {p.reason ? <span className="ml-1 text-ink-3">{p.reason}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parse.issues.length ? (
            <details className="border-t border-line px-5 py-3 text-xs">
              <summary className="cursor-pointer font-medium">Catatan validasi ({parse.issues.length})</summary>
              <ul className="mt-2 space-y-1">
                {parse.issues.map((i, idx) => (
                  <li key={idx} className={cn(i.level === "error" ? "text-bad" : i.level === "warning" ? "text-amber-800" : "text-ink-3")}>
                    Baris {i.row}: {i.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}

      {report ? (
        <Alert tone={report.failed.length === 0 ? "ok" : "warn"} title="Laporan migrasi">
          <p>{report.message}{report.organizationsCreated ? ` ${report.organizationsCreated} organisasi baru dibuat.` : ""}{report.monthlyUpdated ? " Monthly Achievement diperbarui." : ""}</p>
          {report.failed.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {report.failed.map((f, i) => <li key={i}>Baris {f.row} ({f.task}): {f.error}</li>)}
            </ul>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
