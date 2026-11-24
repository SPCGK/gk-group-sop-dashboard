"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useAdminEngine, useApp } from "@/components/app-provider";
import { Alert, Card, PageTitle } from "@/components/ui";
import { buildReport, REPORT_TYPES, toCsv, type ReportType } from "@/lib/export/reports";
import { todayJakarta } from "@/lib/engine/dates";

const DESC: Record<string, string> = {
  "sop-master": "Seluruh SOP aktif dengan jadwal, hari kerja, progres, dan status.",
  "division-progress": "Jumlah SOP per status dan % CAT / % Additional per divisi.",
  "cat-achievement": "% CAT per divisi dan Overall % CAT.",
  "additional-achievement": "% Additional per divisi dan Overall % Additional.",
  "overall-achievement": "Komposisi Overall Achievement sesuai bobot.",
  "monthly-achievement": "Target, input, kontribusi, total, dan variance per bulan.",
  gantt: "Jadwal SOP + visual Gantt (Excel mingguan / PDF).",
  holidays: "Daftar hari libur dan status hari kerja.",
};

function download(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ReportsPage() {
  const eng = useAdminEngine();
  const { auth } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!eng) return null;

  const run = async (type: ReportType, format: "xlsx" | "csv" | "pdf") => {
    setBusy(`${type}-${format}`);
    setError(null);
    try {
      const rep = buildReport(type, eng.result, eng.input.holidays, eng.input.settings.weights);
      const base = `GK-SOP-${type}-${todayJakarta()}`;
      const meta = { generatedBy: auth.email ?? "admin" };
      if (format === "csv") download(toCsv(rep), "text/csv;charset=utf-8", `${base}.csv`);
      else {
        const { toPdf, toXlsx } = await import("@/lib/export/render");
        if (format === "pdf") download(toPdf(rep, eng.result, meta), "application/pdf", `${base}.pdf`);
        else download(await toXlsx(rep, eng.result, meta), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${base}.xlsx`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat laporan.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Reports & Export" description="Laporan dibuat di browser dari calculation engine yang sama dengan Dashboard, sehingga angka identik." />
      {error ? <div className="mb-4"><Alert tone="bad">{error}</Alert></div> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(REPORT_TYPES) as [ReportType, string][]).map(([k, title]) => (
          <Card key={k} className="flex flex-col p-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 flex-1 text-xs text-ink-3">{DESC[k]}</p>
            <div className="mt-3 flex gap-2">
              {(["xlsx", "csv", "pdf"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={!!busy}
                  data-report={`${k}-${f}`}
                  onClick={() => run(k, f)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-50"
                >
                  {busy === `${k}-${f}` ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" aria-hidden />} {f === "xlsx" ? "Excel" : f.toUpperCase()}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
