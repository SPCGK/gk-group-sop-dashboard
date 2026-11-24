"use client";

import { useState } from "react";
import type { Holiday } from "@/lib/engine";
import { HOLIDAY_CATEGORIES } from "@/lib/engine/types";
import { CATEGORY_LABEL, HolidayTable } from "../holiday-list";
import { Alert, Button, Card, CardHeader, FieldError, Input, Label, Select, Textarea } from "../ui";
import { ActionMessage, formObject, SubmitButton, useAction } from "./form-status";

function HolidayForm({ h, onDone }: { h: Holiday | null; onDone: () => void }) {
  const { state, pending, run } = useAction();
  const e = state.errors ?? {};
  return (
    <form
      className="space-y-3"
      key={h?.id ?? "new"}
      onSubmit={async (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const v = formObject(form);
        const r = await run("saveHoliday", { ...v, exclude_from_working_days: v.exclude_from_working_days === "true", id: h?.id });
        if (r.ok) {
          if (!h) form.reset();
          onDone();
        }
      }}
    >
      <div>
        <Label htmlFor="holiday_date">Tanggal *</Label>
        <Input id="holiday_date" name="holiday_date" type="date" defaultValue={h?.holiday_date ?? ""} required />
        <FieldError message={e.holiday_date} />
      </div>
      <div>
        <Label htmlFor="holiday_name">Nama hari libur *</Label>
        <Input id="holiday_name" name="holiday_name" defaultValue={h?.holiday_name ?? ""} required />
        <FieldError message={e.holiday_name} />
      </div>
      <div>
        <Label htmlFor="category">Kategori *</Label>
        <Select id="category" name="category" defaultValue={h?.category ?? "Company Holiday"}>
          {HOLIDAY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]} ({c})</option>)}
        </Select>
      </div>
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-2">Exclude from Working Days</legend>
        <div className="flex gap-2 text-sm">
          <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5"><input type="radio" name="exclude_from_working_days" value="true" defaultChecked={h ? h.exclude_from_working_days : true} />Ya (non-kerja)</label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5"><input type="radio" name="exclude_from_working_days" value="false" defaultChecked={h ? !h.exclude_from_working_days : false} />Tidak</label>
        </div>
      </fieldset>
      <div>
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={h?.description ?? ""} />
      </div>
      <div>
        <Label htmlFor="source">Sumber</Label>
        <Input id="source" name="source" defaultValue={h?.source ?? ""} placeholder="mis. SK Direksi No. …" />
      </div>
      <ActionMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pending={pending}>{h ? "Simpan" : "Tambah tanggal"}</SubmitButton>
        {h ? <Button type="button" variant="ghost" onClick={onDone}>Batal</Button> : null}
      </div>
    </form>
  );
}

export function HolidayManager({ holidays }: { holidays: Holiday[] }) {
  const [editing, setEditing] = useState<Holiday | null>(null);
  const { state: msg, pending, run } = useAction();
  const [year, setYear] = useState("all");
  const years = [...new Set(holidays.map((h) => h.holiday_date.slice(0, 4)))].sort();
  const list = year === "all" ? holidays : holidays.filter((h) => h.holiday_date.startsWith(year));
  const joint = holidays.filter((h) => h.category === "Joint Leave");
  const jointExcluded = joint.filter((h) => h.exclude_from_working_days).length;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <Card className="p-5">
          <p className="font-semibold">Kebijakan Cuti Bersama</p>
          <p className="mt-1 text-sm text-ink-3">
            {jointExcluded}/{joint.length} cuti bersama saat ini dihitung sebagai hari non-kerja. Cuti bersama tidak otomatis menjadi hari non-kerja perusahaan – putuskan di sini.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run("setCategoryExclude", { category: "Joint Leave", exclude: true })}>Jadikan semua non-kerja</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run("setCategoryExclude", { category: "Joint Leave", exclude: false })}>Tetap hari kerja</Button>
          </div>
        </Card>
        {msg.message ? <Alert tone={msg.ok ? "ok" : "bad"}>{msg.message}</Alert> : null}
        <Card>
          <CardHeader
            title="Daftar hari libur"
            description="Perubahan langsung menghitung ulang Mandays, Actual Days, dan Gantt Chart."
            action={
              <Select value={year} onChange={(e) => setYear(e.target.value)} className="h-8 w-auto text-xs" aria-label="Tahun">
                <option value="all">Semua tahun</option>
                {years.map((y) => <option key={y}>{y}</option>)}
              </Select>
            }
          />
          <HolidayTable
            holidays={list}
            actions={(h) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("setHolidayExclude", { id: h.id, exclude: !h.exclude_from_working_days })} title="Ubah status hari kerja">
                  {h.exclude_from_working_days ? "Jadikan hari kerja" : "Jadikan non-kerja"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(h)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-bad"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Hapus ${h.holiday_name} (${h.holiday_date})?`)) return;
                    run("deleteHoliday", { id: h.id });
                  }}
                >
                  Hapus
                </Button>
              </div>
            )}
          />
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title={editing ? "Edit hari libur" : "Tambah hari libur"} />
        <div className="p-5"><HolidayForm h={editing} onDone={() => setEditing(null)} /></div>
      </Card>
    </div>
  );
}
