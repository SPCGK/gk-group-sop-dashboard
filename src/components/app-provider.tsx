"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiGet, apiPost, type ApiResult } from "@/lib/api";
import { runEngine, todayJakarta, type EngineInput, type EngineResult } from "@/lib/engine";
import { toEngineInput, type AdminData, type PublicData } from "@/lib/data-model";

interface AuthState {
  status: "loading" | "signed-out" | "signed-in";
  email: string | null;
  isAdmin: boolean;
  token: string | null;
}

interface AppCtx {
  publicData: PublicData | null;
  publicError: string | null;
  input: EngineInput | null;
  result: EngineResult | null;
  refreshPublic: () => Promise<void>;
  auth: AuthState;
  oauthClientId: string | null;
  signInWithCredential: (credential: string) => Promise<string | null>;
  signOut: () => void;
  adminData: AdminData | null;
  adminError: string | null;
  refreshAdmin: () => Promise<void>;
  /** Admin call: posts with the current token, then refreshes data when the call succeeded and `refresh` is true. */
  call: <T = unknown>(action: string, payload?: unknown, opts?: { refresh?: boolean }) => Promise<ApiResult<T>>;
}

const Ctx = createContext<AppCtx | null>(null);
const TOKEN_KEY = "gk-sop-id-token";

function tokenExp(token: string): number {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(p.exp) * 1000;
  } catch {
    return 0;
  }
}
const store = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) sessionStorage.setItem(TOKEN_KEY, v);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable – session lives in memory only */
    }
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [publicData, setPublicData] = useState<PublicData | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({ status: "loading", email: null, isAdmin: false, token: null });
  const [oauthClientId, setOauthClientId] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const refreshPublic = useCallback(async () => {
    const r = await apiGet<PublicData>("publicData");
    if (r.ok && r.data) {
      setPublicData(r.data);
      setPublicError(null);
    } else setPublicError(r.message ?? "Gagal memuat data.");
  }, []);

  const refreshAdmin = useCallback(async () => {
    if (!tokenRef.current) return;
    const r = await apiPost<AdminData>("adminData", tokenRef.current);
    if (r.ok && r.data) {
      setAdminData(r.data);
      setAdminError(null);
    } else {
      setAdminError(r.message ?? "Gagal memuat data admin.");
      if (r.code === "auth") signOutInternal();
    }
  }, []);

  const signOutInternal = () => {
    tokenRef.current = null;
    store.set(null);
    setAdminData(null);
    setAuth({ status: "signed-out", email: null, isAdmin: false, token: null });
    try {
      (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* ignore */
    }
  };

  const signInWithCredential = useCallback(async (credential: string): Promise<string | null> => {
    if (tokenExp(credential) < Date.now()) return "Sesi login kedaluwarsa. Silakan login ulang.";
    const r = await apiPost<{ email: string | null; isAdmin: boolean }>("whoami", credential);
    if (!r.ok || !r.data?.email) {
      signOutInternal();
      return r.message ?? "Login gagal.";
    }
    tokenRef.current = credential;
    store.set(credential);
    setAuth({ status: "signed-in", email: r.data.email, isAdmin: r.data.isAdmin, token: credential });
    if (r.data.isAdmin) await refreshAdmin();
    return null;
  }, [refreshAdmin]);

  useEffect(() => {
    refreshPublic();
    apiGet<{ oauthClientId: string }>("config").then((r) => setOauthClientId(r.ok ? r.data?.oauthClientId || "" : ""));
    const saved = store.get();
    if (saved && tokenExp(saved) > Date.now() + 30_000) signInWithCredential(saved);
    else setAuth((a) => ({ ...a, status: "signed-out" }));
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as { __e2eLogin?: (t: string) => Promise<string | null> }).__e2eLogin = signInWithCredential;
    }
  }, [refreshPublic, signInWithCredential]);

  // Expire the session when the Google ID token expires (≈1 hour).
  useEffect(() => {
    if (!auth.token) return;
    const ms = tokenExp(auth.token) - Date.now();
    const t = setTimeout(() => signOutInternal(), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [auth.token]);

  const call = useCallback(
    async <T,>(action: string, payload: unknown = {}, opts: { refresh?: boolean } = {}): Promise<ApiResult<T>> => {
      if (!tokenRef.current) return { ok: false, code: "auth", message: "Sesi login berakhir. Silakan login ulang." };
      const r = await apiPost<T>(action, tokenRef.current, payload);
      if (r.code === "auth") signOutInternal();
      if (r.ok && opts.refresh !== false) await Promise.all([refreshAdmin(), refreshPublic()]);
      return r;
    },
    [refreshAdmin, refreshPublic],
  );

  const input = useMemo(() => (publicData ? toEngineInput(publicData, { today: todayJakarta() }) : null), [publicData]);
  const result = useMemo(() => (input ? runEngine(input) : null), [input]);

  const value: AppCtx = {
    publicData,
    publicError,
    input,
    result,
    refreshPublic,
    auth,
    oauthClientId,
    signInWithCredential,
    signOut: signOutInternal,
    adminData,
    adminError,
    refreshAdmin,
    call,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

/** Engine over the admin dataset (includes inactive organizations/SOPs). */
export function useAdminEngine() {
  const { adminData } = useApp();
  return useMemo(() => {
    if (!adminData) return null;
    const input = toEngineInput(adminData, { today: todayJakarta() });
    const activeOrgs = input.organizations;
    const all = toEngineInput(adminData, { today: todayJakarta(), includeInactiveOrgs: true });
    return {
      input,
      result: runEngine(input),
      allOrganizations: all.organizations,
      allTasks: all.tasks,
      activeOrganizations: activeOrgs,
    };
  }, [adminData]);
}
