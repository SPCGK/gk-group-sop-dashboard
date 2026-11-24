"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Loading } from "@/components/data-state";
import { Alert, Badge, Button, Card, Input, PageTitle, Select } from "@/components/ui";
import { describe, TABLE_LABEL } from "@/lib/audit";
import type { AuditLog } from "@/lib/data-model";

type Page = { total: number; page: number; pageSize: number; rows: AuditLog[] };

export default function AuditLogPage() {
  const { call } = useApp();
  const [filters, setFilters] = useState({ table: "", action: "", user: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const f = { ...filters, from: filters.from ? new Date(`${filters.from}T00:00:00+07:00`).toISOString() : "", to: filters.to ? new Date(`${filters.to}T23:59:59+07:00`).toISOString() : "", page, pageSize: 50 };
    const r = await call<Page>("auditLog", f, { refresh: false });
    if (r.ok && r.data) {
      setData(r.data);
      setError(null);
    } else setError(r.message ?? "Gagal memuat audit log.");
  }, [call, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageTitle title="Audit Log" description="Setiap perubahan oleh Administrator dicatat otomatis oleh server (Apps Script) beserta nilai sebelum dan sesudah." />
      <Card className="mb-4 p-4">
        <form
          className="flex flex-wrap items-end gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setPage(1);
            setFilters({ table: String(fd.get("table") ?? ""), action: String(fd.get("action") ?? ""), user: String(fd.get("user") ?? ""), from: String(fd.get("from") ?? ""), to: String(fd.get("to") ?? "") });
          }}
        >
          <Select name="table" defaultValue="" className="h-9 w-auto text-xs" aria-label="Data">
            <option value="">Semua data</option>
            {Object.entries(TABLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select name="action" defaultValue="" className="h-9 w-auto text-xs" aria-label="Aktivitas">
            <option value="">Semua aktivitas</option>
            <option value="INSERT">Tambah</option>
            <option value="UPDATE">Ubah</option>
            <option value="DELETE">Hapus</option>
          </Select>
          <Input name="user" placeholder="Email user" className="h-9 w-44 text-xs" />
          <label className="flex items-center gap-1">Dari <Input type="date" name="from" className="h-9 w-36 text-xs" /></label>
          <label className="flex items-center gap-1">s/d <Input type="date" name="to" className="h-9 w-36 text-xs" /></label>
          <Button size="sm">Terapkan</Button>
        </form>
      </Card>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {!data ? (
        <Loading />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-3 py-2.5 pl-5 text-left font-semibold">Waktu (WIB)</th>
                  <th className="px-3 py-2.5 text-left font-semibold">User</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Aktivitas</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {data.rows.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-3 py-2 pl-5 text-xs tabular text-ink-2">{new Date(l.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "medium" })}</td>
                    <td className="px-3 py-2 text-xs">{l.user_email ?? <span className="text-ink-3">sistem / migrasi</span>}</td>
                    <td className="px-3 py-2">
                      <Badge tone={l.action === "INSERT" ? "ok" : l.action === "DELETE" ? "bad" : "info"}>{l.action === "INSERT" ? "Tambah" : l.action === "DELETE" ? "Hapus" : "Ubah"}</Badge>
                      <span className="ml-1 text-xs text-ink-3">{TABLE_LABEL[l.table_name] ?? l.table_name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <ul className="space-y-0.5">{describe(l).map((d, i) => <li key={i}>{d}</li>)}</ul>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-ink-3">Data lengkap</summary>
                        <div className="mt-1 grid gap-2 sm:grid-cols-2">
                          <pre className="max-h-48 overflow-auto rounded bg-canvas p-2 text-[10px]">{JSON.stringify(l.old_data, null, 1)}</pre>
                          <pre className="max-h-48 overflow-auto rounded bg-canvas p-2 text-[10px]">{JSON.stringify(l.new_data, null, 1)}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-ink-3">Belum ada aktivitas.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-3">
            <span>{data.total} aktivitas</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span>{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
