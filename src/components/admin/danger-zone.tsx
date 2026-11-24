"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Input, Label } from "../ui";
import { useAction } from "./form-status";

export function DangerZone({ id, taskNumber, active }: { id: string; taskNumber: string; active: boolean }) {
  const router = useRouter();
  const { state, pending, run } = useAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => run("setSopActive", { id, active: !active })}>
          {active ? "Arsipkan SOP" : "Pulihkan SOP"}
        </Button>
        <p className="text-xs text-ink-3">{active ? "SOP yang diarsipkan tidak dihitung dan tidak tampil di dashboard publik, namun datanya tetap tersimpan." : "SOP ini sedang diarsipkan."}</p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
        {!confirmOpen ? (
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>Hapus permanen…</Button>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run("deleteSop", { id, confirmation: typed });
              if (r.ok) router.push("/admin/master-sop/?deleted=1");
            }}
            className="space-y-2"
          >
            <p className="text-sm text-red-900">Penghapusan permanen tidak dapat dibatalkan (jejak tetap tercatat di Audit Log). Ketik <strong>{taskNumber}</strong> untuk konfirmasi.</p>
            <Label htmlFor="confirm" className="sr-only">Konfirmasi</Label>
            <div className="flex gap-2">
              <Input id="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className="max-w-[10rem]" autoComplete="off" />
              <Button type="submit" variant="danger" disabled={pending || typed.trim() !== taskNumber}>Hapus</Button>
              <Button type="button" variant="ghost" onClick={() => { setConfirmOpen(false); setTyped(""); }}>Batal</Button>
            </div>
          </form>
        )}
      </div>
      {state.message ? <Alert tone={state.ok ? "ok" : "bad"}>{state.message}</Alert> : null}
    </div>
  );
}
