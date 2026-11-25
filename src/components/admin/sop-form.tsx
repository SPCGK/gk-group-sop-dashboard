"use client";

import { useRouter } from "next/navigation";
import type { Organization, SopTask } from "@/lib/engine";
import { FieldError, Input, Label, Select, Textarea } from "../ui";
import { ActionMessage, formObject, SubmitButton, useAction } from "./form-status";

export function SopForm({ organizations, task }: { organizations: Organization[]; task?: SopTask }) {
  const router = useRouter();
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
          <Input id="start_date" name="start_date" type="date" defaultValue={task?.start_date ?? ""} aria-invalid={!!e.start_date} />
          <FieldError message={e.start_date} />
        </div>
        <div>
          <Label htmlFor="end_date">End Date</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={task?.end_date ?? ""} aria-invalid={!!e.end_date} />
          <FieldError message={e.end_date} />
        </div>
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
