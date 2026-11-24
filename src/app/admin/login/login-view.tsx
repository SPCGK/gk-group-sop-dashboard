"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Loading } from "@/components/data-state";
import { Alert, Button, Card } from "@/components/ui";
import { asset } from "@/lib/api";

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; ux_mode?: string; itp_support?: boolean }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

function loadGis(): Promise<GoogleId> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("Google Sign-In tidak tersedia")));
    s.onerror = () => reject(new Error("Gagal memuat Google Sign-In"));
    document.head.appendChild(s);
  });
}

export function LoginView() {
  const { auth, oauthClientId, signInWithCredential, signOut } = useApp();
  const router = useRouter();
  const btn = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.status === "signed-in" && auth.isAdmin) router.replace("/admin/");
  }, [auth, router]);

  useEffect(() => {
    if (!oauthClientId || auth.status !== "signed-out" || !btn.current) return;
    let cancelled = false;
    loadGis()
      .then((g) => {
        if (cancelled || !btn.current) return;
        g.accounts.id.initialize({
          client_id: oauthClientId,
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
          callback: async (resp) => {
            setBusy(true);
            setError(await signInWithCredential(resp.credential));
            setBusy(false);
          },
        });
        g.accounts.id.renderButton(btn.current, { theme: "outline", size: "large", text: "signin_with", shape: "pill", locale: "id", width: 280 });
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [oauthClientId, auth.status, signInWithCredential]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/gk-mark.png")} alt="GK Group" width={64} height={64} className="size-16" />
          <h1 className="mt-3 text-lg font-semibold">Login Administrator</h1>
          <p className="text-sm text-ink-3">SOP Management &amp; Performance Dashboard 2027</p>
        </div>
        <Card className="p-5">
          {auth.status === "loading" || oauthClientId === null || busy ? (
            <Loading label={busy ? "Memverifikasi akun…" : "Memuat…"} />
          ) : auth.status === "signed-in" && !auth.isAdmin ? (
            <div className="space-y-3">
              <Alert tone="bad" title="Akun tidak memiliki akses Administrator">
                {auth.email} berhasil login dengan Google, tetapi tidak terdaftar sebagai Administrator aktif. Minta Administrator menambahkan email Anda di System Settings.
              </Alert>
              <Button variant="outline" onClick={signOut} className="w-full">Logout / ganti akun</Button>
            </div>
          ) : !oauthClientId ? (
            <Alert tone="warn" title="Login belum dikonfigurasi">
              OAuth Client ID belum diatur di Google Sheet database (menu GK SOP → Atur OAuth Client ID). Lihat docs/HANDOVER.md.
            </Alert>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-center text-sm text-ink-2">Masuk dengan akun Google perusahaan yang terdaftar sebagai Administrator.</p>
              <div ref={btn} className="min-h-[44px]" />
              {error ? <Alert tone="bad">{error}</Alert> : null}
            </div>
          )}
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
            Tidak ada pendaftaran mandiri dan aplikasi tidak menyimpan password. Akses Administrator diatur dari daftar email di System Settings.
          </p>
        </Card>
        <p className="mt-6 text-center text-xs text-ink-3">
          <Link href="/" className="hover:underline">← Kembali ke Dashboard publik</Link>
        </p>
      </div>
    </main>
  );
}
