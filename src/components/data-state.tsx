"use client";
import { Loader2 } from "lucide-react";
import { Alert } from "./ui";

export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-3" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <Alert tone="warn" title="Data belum dapat dimuat">
        <p>{message}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold underline">
            Coba lagi
          </button>
        ) : null}
      </Alert>
    </div>
  );
}
