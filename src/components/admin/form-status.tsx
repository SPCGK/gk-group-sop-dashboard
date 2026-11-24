"use client";
import { useState } from "react";
import type { ApiResult } from "@/lib/api";
import { useApp } from "../app-provider";
import { Alert, Button } from "../ui";

export type FormState = ApiResult & { values?: Record<string, string> };

/** Submits a form to an Apps Script action. Field values stay in the (uncontrolled) inputs on failure. */
export function useAction<T = unknown>() {
  const { call } = useApp();
  const [state, setState] = useState<FormState>({ ok: true });
  const [pending, setPending] = useState(false);
  const run = async (action: string, payload: unknown, opts?: { refresh?: boolean }): Promise<ApiResult<T>> => {
    setPending(true);
    try {
      const r = await call<T>(action, payload, opts);
      setState(r);
      return r;
    } finally {
      setPending(false);
    }
  };
  return { state, setState, pending, run };
}

export function SubmitButton({ children, pending, variant = "primary", className }: { children: React.ReactNode; pending: boolean; variant?: "primary" | "secondary" | "danger" | "outline"; className?: string }) {
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? "Menyimpan…" : children}
    </Button>
  );
}

export function ActionMessage({ state }: { state: ApiResult }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "ok" : "bad"}>{state.message}</Alert>;
}

export const formObject = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
