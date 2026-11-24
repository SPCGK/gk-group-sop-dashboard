"use client";

import { useState } from "react";
import { Pencil, Power } from "lucide-react";
import type { Organization } from "@/lib/engine";
import { DataTable, type Column } from "../data-table";
import { Badge, Button, Card, CardHeader, FieldError, Input, Label, Textarea } from "../ui";
import { ActionMessage, formObject, SubmitButton, useAction } from "./form-status";

type Row = Organization & { sopCount: number };

function OrgForm({ org, onDone }: { org: Organization | null; onDone: () => void }) {
  const { state, pending, run } = useAction();
  const e = state.errors ?? {};
  return (
    <form
      className="space-y-3"
      key={org?.id ?? "new"}
      onSubmit={async (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const r = await run("saveOrganization", { ...formObject(form), id: org?.id });
        if (r.ok) {
          if (!org) form.reset();
          onDone();
        }
      }}
    >
      <div>
        <Label htmlFor="organization_name">Nama organisasi *</Label>
        <Input id="organization_name" name="organization_name" defaultValue={org?.organization_name ?? ""} required />
        <FieldError message={e.organization_name} />
      </div>
      <div>
        <Label htmlFor="organization_code">Kode</Label>
        <Input id="organization_code" name="organization_code" defaultValue={org?.organization_code ?? ""} maxLength={30} placeholder="mis. ITM" />
        <FieldError message={e.organization_code} />
      </div>
      <div>
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={org?.description ?? ""} />
      </div>
      <ActionMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pending={pending}>{org ? "Simpan perubahan" : "Tambah organisasi"}</SubmitButton>
        {org ? <Button type="button" variant="ghost" onClick={onDone}>Batal</Button> : null}
      </div>
    </form>
  );
}

export function OrganizationManager({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Organization | null>(null);
  const { state, pending, run } = useAction();
  const columns: Column<Row>[] = [
    { key: "no", header: "No", cell: (r) => <span className="tabular">{r.sort_order}</span>, sortValue: (r) => r.sort_order },
    { key: "name", header: "Organisasi", cell: (r) => <span className="font-medium">{r.organization_name}</span>, sortValue: (r) => r.organization_name },
    { key: "code", header: "Kode", cell: (r) => r.organization_code ?? "—", sortValue: (r) => r.organization_code },
    { key: "sop", header: "SOP aktif", cell: (r) => r.sopCount, sortValue: (r) => r.sopCount, className: "tabular" },
    { key: "st", header: "Status", cell: (r) => (r.is_active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="warn">Nonaktif</Badge>), sortValue: (r) => (r.is_active ? 0 : 1) },
    {
      key: "act",
      header: "",
      cell: (r) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="size-3" />Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (r.is_active && !window.confirm(`Nonaktifkan ${r.organization_name}? Organisasi dan SOP-nya tidak akan tampil di dashboard.`)) return;
              run("setOrganizationActive", { id: r.id, active: !r.is_active });
            }}
          >
            <Power className="size-3" />{r.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader title={`${rows.length} organisasi`} description="Nomor urut menjadi awalan Task Number (mis. 4.x untuk ITM)." />
        {state.message ? <div className="px-5 pt-3"><ActionMessage state={state} /></div> : null}
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} searchText={(r) => `${r.organization_name} ${r.organization_code ?? ""}`} initialSort={{ key: "no", dir: "asc" }} pageSize={25} />
      </Card>
      <Card className="h-fit">
        <CardHeader title={editing ? `Edit: ${editing.organization_name}` : "Tambah organisasi"} />
        <div className="p-5"><OrgForm org={editing} onDone={() => setEditing(null)} /></div>
      </Card>
    </div>
  );
}
