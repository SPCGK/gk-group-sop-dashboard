"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildHolidaySet, holidaysWithin, mandays, workdayAdd, type Holiday, type Organization, type SopTask } from "@/lib/engine";
import { formatDateId } from "@/lib/engine/dates";
import { FieldError, Input, Label, Select, Textarea } from "../ui";
import { ActionMessage, formObject, SubmitButton, useAction } from "./form-status";

/** Mandays (hari kerja) dari Start–End: Sabtu/Minggu dan libur di Holiday Management tidak dihitung. */
function MandaysInfo({ start, end, holidays, onSetEnd }: { start: string; end: string; holidays: Holiday[]; onSetEnd: (iso: string) => void }) {
  const set = useMemo(() => buildHolidaySet(holidays), [holidays]);
  const [duration, setDuration] = useState(25);
  const md = start && end ? mandays(start, end, set) : null;
  const inRange = start && end ? holidaysWithin(start, end, set) : [];
  const names = new Map(holidays.map((h) => [h.holiday_date, h.holiday_name]));
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-2 sm:col-span-2" data-testid="mandays-info">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-medium text-ink">Mandays: </span>
          {md === null ? <span className="text-ink-3">isi Start Date dan End Date</span> : md < 0 ? <span className="text-bad">End Date sebelum Start Date</span> : <span className="text-base font-semibold tabular text-ink">{md} hari kerja</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <label htmlFor="duration_wd" className="text-ink-3">End Date = Start +</label>
          <input id="duration_wd" type="number" min={1} max={500} value={duration} onChange={(ev) => setDuration(Math.max(1, Math.min(500, Math.round(Number(ev.target.value) || 1))))} className="h-7 w-16 rounded-md border border-line bg-white px-1.5 text-right tabular" />
          <span className="text-ink-3">hari kerja</span>
          <button
            type="button"
            disabled={!start}
            onClick={() => {
              const e = workdayAdd(start, duration, set);
              if (e) onSetEnd(e);
            }}
            className="h-7 rounded-md border border-line bg-white px-2 font-medium hover:bg-gray-50 disabled:opacity-40"
          >
            Atur End Date
          </button>
        </div>
      </div>
      <p className="mt-1 text-ink-3">
        Sabtu, Minggu, dan hari libur di Holiday Management (yang dikecualikan dari hari kerja) tidak dihitung · rumus NETWORKDAYS − 1, sama dengan kolom Mandays.
      </p>
      {inRange.length ? (
        <p className="mt-1 text-ink-3">
          Libur dalam rentang ini ({inRange.length}): {inRange.map((d) => `${formatDateId(d)}${names.get(d) ? ` – ${names.get(d)}` : ""}`).join("; ")}
        </p>
      ) : null}
    </div>
  );
}

export function SopForm({ organizations, task, holidays = [] }: { organizations: Organization[]; task?: SopTask; holidays?: Holiday[] }) {
  const router = useRouter();
  const [start, setStart] = useState(task?.start_date ?? "");
  const [end, setEnd] = useState(task?.end_date ?? "");
  const { state, pending, run } = useAction<{ id: string; task_number: string }>();
  const e = state.errors ?? {};
  const activeOrgs = organizations.filter((o) => o.is_active || o.id === task?.organization_id).sort((a, b) => a.sort_order - b.sort_order);
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={async (ev) => {
        ev.preventDefault();
        const v = formObject(ev.currentTarget);
        const payload = { ...v, critical: v.critical === "true", id: task?.id };
        const r = await run(task ? "updateSop" : "createSop", payload);
        if (r.ok && !task && r.data?.id) router.push(`/admin/sop/edit/?id=${r.data.id}&created=1`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="organization_id">Divisi / Departemen / Business Unit *</Label>
          <Select id="organization_id" name="organization_id" defaultValue={task?.organization_id ?? ""} required aria-invalid={!!e.organization_id}>
            <option value="" disabled>Pilih organisasi…</option>
            {activeOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.sort_order}. {o.organization_name}{o.is_active ? "" : " (nonaktif)"}</option>
            ))}
          </Select>
          <FieldError message={e.organization_id} />
          {task ? <p className="mt-1 text-xs text-ink-3">Memindahkan SOP ke organisasi lain akan memberi Task Number baru.</p> : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sop_name">Nama SOP *</Label>
          <Input id="sop_name" name="sop_name" defaultValue={task?.sop_name ?? ""} required maxLength={300} placeholder="mis. SOP Pengelolaan Kontrak" aria-invalid={!!e.sop_name} />
          <FieldError message={e.sop_name} />
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-ink-2">Jenis tugas *</legend>
          <div className="flex gap-2">
            {(["CAT", "Additional"] as const).map((v) => (
              <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas">
                <input type="radio" name="task_type" value={v} defaultChecked={task?.task_type === v} className="accent-[var(--ink)]" /> {v}
              </label>
            ))}
          </div>
          {task && !task.task_type ? <p className="mt-1 text-xs text-warn">Belum diisi – pilih CAT atau Additional.</p> : null}
          <FieldError message={e.task_type} />
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-ink-2">New / Revision *</legend>
          {task && !task.document_classification ? <p className="mb-1 text-xs text-warn">Belum diisi – pilih New atau Revision.</p> : null}
          <div className="flex gap-2">
            {(["New", "Revision"] as const).map((v) => (
              <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas">
                <input type="radio" name="document_classification" value={v} defaultChecked={(task ? task.document_classification : "New") === v} className="accent-[var(--ink)]" /> {v}
              </label>
            ))}
          </div>
          <FieldError message={e.document_classification} />
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-medium text-ink-2">Critical</legend>
          <div className="flex gap-2">
            {[["false", "Non-Critical"], ["true", "Critical"]].map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-canvas">
                <input type="radio" name="critical" value={v} defaultChecked={String(task?.critical ?? false) === v} className="accent-[var(--ink)]" /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" name="start_date" type="date" value={start} onChange={(ev) => setStart(ev.target.value)} aria-invalid={!!e.start_date} />
          <FieldError message={e.start_date} />
        </div>
        <div>
          <Label htmlFor="end_date">End Date</Label>
          <Input id="end_date" name="end_date" type="date" value={end} onChange={(ev) => setEnd(ev.target.value)} aria-invalid={!!e.end_date} />
          <FieldError message={e.end_date} />
        </div>
        <MandaysInfo start={start} end={end} holidays={holidays} onSetEnd={setEnd} />
        <div className="sm:col-span-2">
          <Label htmlFor="remark">Remark</Label>
          <Textarea id="remark" name="remark" rows={3} defaultValue={task?.remark ?? ""} maxLength={2000} />
        </div>
      </div>
      <ActionMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>{task ? "Simpan perubahan" : "Simpan SOP"}</SubmitButton>
      </div>
    </form>
  );
}
