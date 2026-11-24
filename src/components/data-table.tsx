"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn, Input, Select } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
  headerClassName?: string;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  filters = [],
  initialSort,
  pageSize: initialPageSize = 15,
  emptyMessage = "Tidak ada data.",
  toolbar,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  filters?: FilterDef<T>[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  emptyMessage?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && searchText && !searchText(r).toLowerCase().includes(needle)) return false;
      for (const f of filters) {
        const v = filterValues[f.key];
        if (v && !f.match(r, v)) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const sv = col.sortValue;
        out = [...out].sort((a, b) => {
          const va = sv(a);
          const vb = sv(b);
          if (va === vb) return 0;
          if (va === null || va === undefined) return 1; // nulls last
          if (vb === null || vb === undefined) return -1;
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "id", { numeric: true });
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, filterValues, sort, columns, filters, searchText]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        {searchText ? (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari…"
              className="h-9 pl-9"
              aria-label="Cari"
            />
          </div>
        ) : null}
        {filters.map((f) => (
          <Select
            key={f.key}
            value={filterValues[f.key] ?? ""}
            onChange={(e) => {
              setFilterValues((v) => ({ ...v, [f.key]: e.target.value }));
              setPage(1);
            }}
            className="h-9 w-auto min-w-[8.5rem] text-xs"
            aria-label={f.label}
          >
            <option value="">{f.label}: Semua</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-3">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={cn("px-3 py-2.5 font-semibold first:pl-4 sm:first:pl-5", c.headerClassName)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-3">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((r) => (
                <tr key={rowKey(r)} className={cn("align-top hover:bg-canvas/60", rowClassName?.(r))}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2.5 first:pl-4 sm:first:pl-5", c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-ink-3 sm:px-5">
        <span className="tabular">
          {filtered.length === 0 ? 0 : (current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} dari {filtered.length} data
        </span>
        <div className="flex items-center gap-2">
          <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 w-auto text-xs" aria-label="Baris per halaman">
            {[10, 15, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / hal</option>
            ))}
          </Select>
          <button type="button" className="rounded-md border border-line p-1.5 disabled:opacity-40" onClick={() => setPage(current - 1)} disabled={current <= 1} aria-label="Halaman sebelumnya">
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular">{current} / {pages}</span>
          <button type="button" className="rounded-md border border-line p-1.5 disabled:opacity-40" onClick={() => setPage(current + 1)} disabled={current >= pages} aria-label="Halaman berikutnya">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
