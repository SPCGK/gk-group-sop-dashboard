"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Flame, Search, X, CalendarClock } from "lucide-react";
import type { EnrichedTask, Holiday, Organization } from "@/lib/engine";
import { barGeometry, buildTimeline, DAY_WIDTH, fmtPct, type GanttScale } from "@/lib/engine";
import { formatDateId, isValidIsoDate, ID_MONTHS_LONG, monthShortId, toDayNumber } from "@/lib/engine/dates";
import { StageBadge } from "./status";
import { Button, cn, Input, Select } from "./ui";

const ROW_H = 36;
const GROUP_H = 32;

export function GanttChart({
  tasks,
  organizations,
  holidays,
  projectStart,
  projectEnd,
  today,
  adminLinks = false,
  highlightId,
  maxHeight = "70vh",
}: {
  tasks: EnrichedTask[];
  organizations: Organization[];
  holidays: Holiday[];
  projectStart: string;
  projectEnd: string;
  today: string;
  adminLinks?: boolean;
  /** SOP yang sedang diedit: baris & bar diberi warna sorotan dan chart menggulir ke jadwalnya. */
  highlightId?: string;
  maxHeight?: string;
}) {
  const [scale, setScale] = useState<GanttScale>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [orgFilter, setOrgFilter] = useState("");
  const [q, setQ] = useState("");
  const [onlyScheduled, setOnlyScheduled] = useState(false);
  const [selected, setSelected] = useState<EnrichedTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Window = project period, widened to include any SOP scheduled outside it.
  const [winStart, winEnd] = useMemo(() => {
    let s = projectStart;
    let e = projectEnd;
    for (const t of tasks) {
      if (isValidIsoDate(t.start_date) && t.start_date < s) s = t.start_date;
      if (isValidIsoDate(t.end_date) && t.end_date > e) e = t.end_date;
    }
    return [s.slice(0, 8) + "01", e];
  }, [tasks, projectStart, projectEnd]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays) if (h.exclude_from_working_days) m.set(h.holiday_date, `${h.holiday_name} (${h.category})`);
    return m;
  }, [holidays]);
  const nonWorkingInfo = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays) if (!h.exclude_from_working_days) m.set(h.holiday_date, `${h.holiday_name} – tetap hari kerja`);
    return m;
  }, [holidays]);

  const days = useMemo(() => buildTimeline(winStart, winEnd, holidayMap, today), [winStart, winEnd, holidayMap, today]);
  const dw = DAY_WIDTH[scale];
  const width = days.length * dw;
  const tlStart = days[0]?.date ?? winStart;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return organizations
      .filter((o) => !orgFilter || o.id === orgFilter)
      .map((o) => ({
        org: o,
        tasks: tasks.filter(
          (t) =>
            t.organization_id === o.id &&
            (!needle || `${t.task_number} ${t.sop_name}`.toLowerCase().includes(needle)) &&
            (!onlyScheduled || (t.start_date && t.end_date)),
        ),
      }))
      .filter((g) => g.tasks.length > 0 || (!needle && !onlyScheduled && !orgFilter));
  }, [organizations, tasks, orgFilter, q, onlyScheduled]);

  // Month header segments
  const months = useMemo(() => {
    const segs: { label: string; start: number; len: number }[] = [];
    for (const d of days) {
      const key = d.date.slice(0, 7);
      const last = segs[segs.length - 1];
      if (last && last.label === key) last.len++;
      else segs.push({ label: key, start: d.index, len: 1 });
    }
    return segs.map((s) => {
      const [y, m] = s.label.split("-");
      return { ...s, text: scale === "month" ? `${monthShortId(Number(m))} ${y.slice(2)}` : `${ID_MONTHS_LONG[Number(m) - 1]} ${y}` };
    });
  }, [days, scale]);

  const weeks = useMemo(() => days.filter((d) => d.index % 7 === 0), [days]);
  const todayIdx = days.findIndex((d) => d.isToday);

  const highlightStart = highlightId ? tasks.find((t) => t.id === highlightId)?.start_date ?? null : null;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll to the highlighted SOP; else to today when inside the project period; else to the project start.
    const inProject = today >= projectStart && today <= projectEnd;
    const target =
      highlightStart && isValidIsoDate(highlightStart)
        ? Math.max(0, toDayNumber(highlightStart) - toDayNumber(tlStart))
        : inProject && todayIdx >= 0
          ? todayIdx
          : Math.max(0, toDayNumber(projectStart) - toDayNumber(tlStart));
    el.scrollLeft = Math.max(0, target * dw - 120);
    if (highlightId) {
      const row = el.querySelector<HTMLElement>(`[data-task-row="${highlightId}"]`);
      if (row) el.scrollTop = Math.max(0, row.offsetTop - 120);
    }
  }, [scale, dw, todayIdx, projectStart, projectEnd, today, tlStart, highlightStart, highlightId]);

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const unscheduled = tasks.filter((t) => !t.start_date || !t.end_date).length;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5 no-print">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Skala waktu">
          {(["day", "week", "month"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium", scale === s ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas")}
              aria-pressed={scale === s}
            >
              {s === "day" ? "Daily" : s === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <Select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="h-9 w-auto text-xs" aria-label="Filter organisasi">
          <option value="">Semua organisasi</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.organization_name}</option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SOP…" className="h-9 w-48 pl-9 text-xs" aria-label="Cari SOP" />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-ink-2">
          <input type="checkbox" checked={onlyScheduled} onChange={(e) => setOnlyScheduled(e.target.checked)} className="size-4 accent-[var(--ink)]" />
          Hanya yang terjadwal
        </label>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(new Set(organizations.map((o) => o.id)))}>Collapse all</Button>
        </div>
      </div>

      <Legend />
      {unscheduled > 0 ? (
        <p className="px-4 pb-2 text-xs text-ink-3 sm:px-5">{unscheduled} SOP belum memiliki Start/End Date sehingga tidak memiliki bar.</p>
      ) : null}

      {/* Chart */}
      <div ref={scrollRef} className="scroll-thin relative overflow-auto border-t border-line" style={{ overscrollBehaviorX: "contain", maxHeight }}>
        <div className="relative" style={{ width: `calc(var(--gantt-left) + ${width}px)`, ["--gantt-left" as string]: "clamp(150px, 32vw, 320px)" }}>
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-line bg-white">
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-line bg-white px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3" style={{ width: "var(--gantt-left)" }}>
              SOP
            </div>
            <div className="relative" style={{ width, height: scale === "month" ? 26 : 46 }}>
              {months.map((m) => (
                <div key={m.label} className="absolute top-0 truncate border-l border-line px-1.5 text-[11px] font-semibold leading-[22px] text-ink-2" style={{ left: m.start * dw, width: m.len * dw }}>
                  {m.len * dw > 28 ? m.text : ""}
                </div>
              ))}
              {scale === "day"
                ? days.map((d) => (
                    <div
                      key={d.date}
                      className={cn("absolute top-[22px] flex h-6 flex-col items-center justify-center text-[10px] leading-none", d.weekend || d.holidayName ? "text-bad" : "text-ink-3", d.isToday && "rounded bg-bad font-semibold text-white")}
                      style={{ left: d.index * dw, width: dw }}
                      title={d.holidayName ?? undefined}
                    >
                      <span>{Number(d.date.slice(8))}</span>
                      <span className="opacity-70">{"SMTWTFS"[new Date(d.date + "T00:00:00Z").getUTCDay()]}</span>
                    </div>
                  ))
                : scale === "week"
                  ? weeks.map((d) => (
                      <div key={d.date} className="absolute top-[22px] h-6 border-l border-line pl-1 text-[10px] leading-6 text-ink-3" style={{ left: d.index * dw, width: 7 * dw }}>
                        {Number(d.date.slice(8))}/{Number(d.date.slice(5, 7))}
                      </div>
                    ))
                  : null}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {/* Background stripes: weekends, holidays, today */}
            <div className="pointer-events-none absolute inset-y-0 z-0" style={{ left: "var(--gantt-left)", width }} aria-hidden>
              {scale !== "month" &&
                days
                  .filter((d) => d.weekend || d.holidayName)
                  .map((d) => (
                    <div key={d.date} className={cn("absolute inset-y-0", d.holidayName ? "bg-red-100/70" : "bg-gray-100")} style={{ left: d.index * dw, width: dw }} />
                  ))}
              {scale === "month" &&
                days
                  .filter((d) => d.holidayName)
                  .map((d) => <div key={d.date} className="absolute inset-y-0 bg-red-200/60" style={{ left: d.index * dw, width: Math.max(dw, 2) }} />)}
              {scale !== "day" && months.map((m) => <div key={m.label} className="absolute inset-y-0 border-l border-line/80" style={{ left: m.start * dw }} />)}
              {todayIdx >= 0 ? <div className="absolute inset-y-0 z-10 w-0.5 bg-bad" style={{ left: todayIdx * dw + dw / 2 - 1 }} title="Hari ini" /> : null}
            </div>

            {groups.map(({ org, tasks: list }) => {
              const isCollapsed = collapsed.has(org.id);
              return (
                <Fragment key={org.id}>
                  <div className="relative z-[1] flex border-b border-line bg-canvas/90" style={{ height: GROUP_H }}>
                    <button
                      type="button"
                      onClick={() => toggle(org.id)}
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-line bg-canvas px-2 text-left text-xs font-semibold text-ink"
                      style={{ width: "var(--gantt-left)" }}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronRight className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                      <span className="truncate">{org.sort_order}. {org.organization_name}</span>
                      <span className="ml-auto shrink-0 rounded bg-white px-1.5 text-[10px] font-medium text-ink-3 ring-1 ring-line">{list.length}</span>
                    </button>
                    <div style={{ width }} />
                  </div>
                  {!isCollapsed &&
                    list.map((t) => {
                      const g = barGeometry(t, t.progress, tlStart, days.length, today);
                      const hold = t.progress.status === "Hold";
                      const hl = t.id === highlightId;
                      return (
                        <div key={t.id} data-task-row={t.id} className={cn("relative z-[1] flex border-b border-line/70 hover:bg-brand-soft/30", hl && "bg-brand-soft/60")} style={{ height: ROW_H }}>
                          <button
                            type="button"
                            onClick={() => setSelected(t)}
                            className={cn("sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line px-3 text-left", hl ? "bg-brand-soft font-semibold" : "bg-white")}
                            style={{ width: "var(--gantt-left)" }}
                          >
                            <span className="w-9 shrink-0 text-[11px] text-ink-3 tabular">{t.task_number}</span>
                            <span className="truncate text-xs text-ink">{t.sop_name}</span>
                            {t.critical ? <Flame className="size-3.5 shrink-0 text-bad" aria-label="Critical" /> : null}
                          </button>
                          <div className="relative" style={{ width }}>
                            {g ? (
                              <button
                                type="button"
                                onClick={() => setSelected(t)}
                                className={cn(
                                  "absolute top-2 h-5 overflow-hidden rounded-[4px] border text-left",
                                  hl ? "border-brand-strong bg-amber-200 ring-2 ring-brand" : hold ? "border-warn bg-amber-100" : "border-cat/60 bg-blue-100",
                                  g.overdue && "border-bad ring-2 ring-bad/40",
                                  t.critical && "border-l-4 border-l-bad",
                                )}
                                style={{
                                  left: g.offset * dw,
                                  width: Math.max(g.length * dw, 4),
                                  backgroundImage: hold ? "repeating-linear-gradient(45deg, rgba(217,119,6,.25) 0 4px, transparent 4px 8px)" : undefined,
                                }}
                                title={`${t.task_number} ${t.sop_name}\n${formatDateId(t.start_date)} – ${formatDateId(t.end_date)}\nProgress: ${t.progress.value === null ? "belum diinput" : fmtPct(t.progress.value, 0)}${g.overdue ? "\nOVERDUE" : ""}`}
                                aria-label={`${t.sop_name}, ${formatDateId(t.start_date)} sampai ${formatDateId(t.end_date)}, progres ${t.progress.value === null ? "belum diinput" : fmtPct(t.progress.value, 0)}`}
                              >
                                <span className={cn("block h-full", t.progress.status === "Completed" ? "bg-ok" : "bg-cat")} style={{ width: g.progressDays * dw }} />
                                {g.length * dw > 60 ? (
                                  <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-semibold text-ink mix-blend-normal">
                                    <span className="rounded bg-white/80 px-1">{t.progress.value === null ? "–" : fmtPct(t.progress.value, 0)}</span>
                                  </span>
                                ) : null}
                              </button>
                            ) : null}
                            {g?.actualEndOffset !== null && g?.actualEndOffset !== undefined ? (
                              <span
                                className="absolute top-[11px] size-3 rotate-45 border-2 border-white bg-ink shadow"
                                style={{ left: g.actualEndOffset * dw + dw / 2 - 6 }}
                                title={`Actual End: ${formatDateId(t.actual_end_date)}`}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </Fragment>
              );
            })}
            {groups.length === 0 ? <p className="sticky left-0 px-4 py-10 text-sm text-ink-3">Tidak ada SOP yang cocok dengan filter.</p> : null}
          </div>
        </div>
      </div>

      {selected ? <DetailCard task={selected} onClose={() => setSelected(null)} adminLinks={adminLinks} note={nonWorkingInfo} /> : null}
    </div>
  );
}

function Legend() {
  const item = (el: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">{el}{label}</span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pb-3 text-[11px] text-ink-2 sm:px-5">
      {item(<span className="h-3 w-6 rounded-[3px] border border-cat/60 bg-blue-100" />, "Rencana (Start–End)")}
      {item(<span className="h-3 w-6 rounded-[3px] bg-cat" />, "Progres")}
      {item(<span className="h-3 w-6 rounded-[3px] bg-ok" />, "Completed")}
      {item(<span className="h-3 w-6 rounded-[3px] border border-bad ring-2 ring-bad/40 bg-blue-100" />, "Overdue")}
      {item(<span className="h-3 w-6 rounded-[3px] border-l-4 border-l-bad border border-cat/60 bg-blue-100" />, "Critical")}
      {item(<span className="h-3 w-6 rounded-[3px] border border-warn" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(217,119,6,.35) 0 3px, transparent 3px 6px)" }} />, "Hold")}
      {item(<span className="size-2.5 rotate-45 bg-ink" />, "Actual End Date")}
      {item(<span className="h-3 w-3 bg-gray-200" />, "Weekend")}
      {item(<span className="h-3 w-3 bg-red-200" />, "Hari libur (non-kerja)")}
      {item(<span className="h-3 w-0.5 bg-bad" />, "Hari ini")}
    </div>
  );
}

function DetailCard({ task: t, onClose, adminLinks, note }: { task: EnrichedTask; onClose: () => void; adminLinks: boolean; note: Map<string, string> }) {
  const jointInRange = t.start_date && t.end_date ? [...note.keys()].filter((d) => d >= t.start_date! && d <= t.end_date!).length : 0;
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg rounded-xl border border-line bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6" role="dialog" aria-label="Detail SOP">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">{t.task_number} · {t.organization_name}</p>
          <p className="font-semibold text-ink">{t.sop_name}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 hover:bg-canvas" aria-label="Tutup">
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-ink-3">Start – End</dt>
        <dd className="text-right tabular">{formatDateId(t.start_date)} – {formatDateId(t.end_date)}</dd>
        <dt className="text-ink-3">Actual End</dt>
        <dd className="text-right tabular">{formatDateId(t.actual_end_date)}</dd>
        <dt className="text-ink-3">Mandays / Man Days</dt>
        <dd className="text-right tabular">{t.mandays ?? "—"} / {t.man_days ?? "—"}</dd>
        <dt className="text-ink-3">Actual Days</dt>
        <dd className={cn("text-right tabular", t.on_time === false && "font-semibold text-bad", t.on_time === true && "text-ok")}>{t.actual_days ?? "—"}{t.on_time === false ? " (terlambat)" : ""}</dd>
        <dt className="text-ink-3">Progress</dt>
        <dd className="text-right tabular">{t.progress.value === null ? "Belum diinput" : fmtPct(t.progress.value, 0)}</dd>
        <dt className="text-ink-3">Status</dt>
        <dd className="text-right"><StageBadge progress={t.progress} /></dd>
      </dl>
      {jointInRange ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-3"><CalendarClock className="size-3" />{jointInRange} cuti bersama dalam periode ini masih dihitung hari kerja.</p>
      ) : null}
      {t.overdue ? <p className="mt-2 text-xs font-medium text-bad">Overdue – End Date sudah lewat dan SOP belum selesai.</p> : null}
      {adminLinks ? (
        <Link href={`/admin/sop/edit/?id=${t.id}`} className="mt-3 inline-flex text-xs font-semibold text-cat hover:underline">Ubah jadwal / progres →</Link>
      ) : null}
    </div>
  );
}

