"use client";

import { useState } from "react";
import type { AdminData, AdminRecord } from "@/lib/data-model";
import { Badge, Button, Card, CardHeader, FieldError, Input, Label } from "../ui";
import { ActionMessage, formObject, SubmitButton, useAction } from "./form-status";

export function SettingsForm({ data }: { data: AdminData }) {
  const { state, pending, run } = useAction();
  const s = data.settings;
  const [cat, setCat] = useState(s.weights.cat);
  const [add, setAdd] = useState(s.weights.additional);
  const e = state.errors ?? {};
  const total = Number(cat) + Number(add);
  return (
    <form
      className="space-y-6 p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const v = formObject(ev.currentTarget);
        run("saveSettings", {
          weights: { cat: Number(v.weight_cat), additional: Number(v.weight_additional) },
          project: { start: v.project_start, end: v.project_end, name: v.project_name },
          treat_uninput_as_zero: v.treat_uninput_as_zero === "true",
          oauth_client_id: v.oauth_client_id,
          source: { spreadsheet_id: v.source_spreadsheet_id, sheet_name: v.source_sheet_name },
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">Bobot Overall Achievement</legend>
        <p className="text-xs text-ink-3">Overall Achievement = (% CAT × bobot CAT) + (% Additional × bobot Additional). Total wajib 100%. Bobot tidak pernah diubah otomatis bila salah satu kategori kosong – hasil ditampilkan N/A.</p>
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <div>
            <Label htmlFor="weight_cat">CAT (%)</Label>
            <Input id="weight_cat" name="weight_cat" type="number" min={0} max={100} step="0.01" value={cat} onChange={(ev) => setCat(Number(ev.target.value))} />
          </div>
          <div>
            <Label htmlFor="weight_additional">Additional (%)</Label>
            <Input id="weight_additional" name="weight_additional" type="number" min={0} max={100} step="0.01" value={add} onChange={(ev) => setAdd(Number(ev.target.value))} />
          </div>
        </div>
        <p className={`mt-1 text-xs ${Math.abs(total - 100) < 1e-9 ? "text-ok" : "text-bad"}`}>Total: {total}%</p>
        <FieldError message={e.weight_cat} />
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Periode Project</legend>
        <div className="mt-2 grid max-w-xl gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label htmlFor="project_name">Nama</Label>
            <Input id="project_name" name="project_name" defaultValue={s.project.name ?? ""} />
          </div>
          <div>
            <Label htmlFor="project_start">Start</Label>
            <Input id="project_start" name="project_start" type="date" defaultValue={s.project.start} />
          </div>
          <div>
            <Label htmlFor="project_end">End</Label>
            <Input id="project_end" name="project_end" type="date" defaultValue={s.project.end} />
            <FieldError message={e.project_end} />
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">SOP yang belum diinput progresnya</legend>
        <div className="mt-2 space-y-1.5 text-sm">
          <label className="flex items-start gap-2"><input type="radio" name="treat_uninput_as_zero" value="true" defaultChecked={s.treat_uninput_as_zero} className="mt-1" /><span>Dihitung 0% pada rata-rata divisi <span className="text-ink-3">(perilaku workbook – direkomendasikan)</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" name="treat_uninput_as_zero" value="false" defaultChecked={!s.treat_uninput_as_zero} className="mt-1" /><span>Tidak dihitung sampai progres diinput</span></label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Integrasi Google</legend>
        <div className="mt-2 grid max-w-2xl gap-3">
          <div>
            <Label htmlFor="oauth_client_id">OAuth Client ID (login Administrator)</Label>
            <Input id="oauth_client_id" name="oauth_client_id" defaultValue={data.oauthClientId} placeholder="…apps.googleusercontent.com" />
            <FieldError message={e.oauth_client_id} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label htmlFor="source_spreadsheet_id">ID Google Sheets sumber (SPC Schedule)</Label>
              <Input id="source_spreadsheet_id" name="source_spreadsheet_id" defaultValue={s.source?.spreadsheet_id ?? ""} />
              <FieldError message={e.source_spreadsheet_id} />
            </div>
            <div>
              <Label htmlFor="source_sheet_name">Nama sheet</Label>
              <Input id="source_sheet_name" name="source_sheet_name" defaultValue={s.source?.sheet_name ?? "SPC Schedule 2027"} />
            </div>
          </div>
        </div>
      </fieldset>
      <ActionMessage state={state} />
      <SubmitButton pending={pending}>Simpan pengaturan</SubmitButton>
    </form>
  );
}

export function AdminUsers({ admins, selfEmail }: { admins: AdminRecord[]; selfEmail: string }) {
  const add = useAction();
  const toggle = useAction();
  return (
    <Card>
      <CardHeader title="Administrator" description="Tidak ada registrasi bebas. Hanya email di daftar ini (akun Google) yang dapat login sebagai Administrator." />
      <div className="divide-y divide-line">
        {admins.map((a) => (
          <div key={a.email} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
            <span className="font-medium">{a.email}</span>
            {a.note ? <span className="text-xs text-ink-3">· {a.note}</span> : null}
            {a.email === selfEmail ? <Badge tone="brand">Anda</Badge> : null}
            {a.is_active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="warn">Nonaktif</Badge>}
            {a.email !== selfEmail ? (
              <Button size="sm" variant="ghost" className="ml-auto" disabled={toggle.pending} onClick={() => toggle.run("setAdminActive", { email: a.email, active: !a.is_active })}>
                {a.is_active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-t border-line p-5">
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const form = ev.currentTarget;
            const r = await add.run("addAdmin", formObject(form));
            if (r.ok) form.reset();
          }}
        >
          <div>
            <Input name="email" type="email" placeholder="email@gankapital.com" className="h-9 w-64" aria-label="Email admin baru" />
            <FieldError message={add.state.errors?.email} />
          </div>
          <Input name="note" placeholder="Catatan (opsional)" className="h-9 w-48" aria-label="Catatan" />
          <SubmitButton pending={add.pending} variant="outline">Tambah Administrator</SubmitButton>
        </form>
        <div className="mt-3 space-y-2">
          <ActionMessage state={add.state} />
          <ActionMessage state={toggle.state} />
        </div>
      </div>
    </Card>
  );
}
