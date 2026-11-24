// Client for the Google Apps Script web app (apps-script/Code.gs).

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (p: string) => `${BASE_PATH}${p}`;

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
  errors?: Record<string, string> | null;
}

let cachedApiUrl: string | null = null;

/** The only deployment-specific value lives in public/app-config.json (editable on GitHub). */
export async function getApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;
  const res = await fetch(asset("/app-config.json"), { cache: "no-store" });
  if (!res.ok) throw new Error("app-config.json tidak ditemukan.");
  const cfg = (await res.json()) as { apiUrl?: string };
  const url = (cfg.apiUrl ?? "").trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    throw new Error("URL Web App Apps Script belum diisi di public/app-config.json (lihat README → Setup).");
  }
  cachedApiUrl = url;
  return url;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, code: "network", message: `Respons server tidak valid (HTTP ${res.status}).` };
  }
}

export async function apiGet<T>(action: string): Promise<ApiResult<T>> {
  try {
    const url = await getApiUrl();
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}action=${encodeURIComponent(action)}&t=${Date.now()}`, { cache: "no-store" });
    return parse<T>(res);
  } catch (e) {
    return { ok: false, code: "network", message: e instanceof Error ? e.message : "Tidak dapat terhubung ke server." };
  }
}

/**
 * POST with Content-Type text/plain → a "simple" CORS request (no preflight), which Apps Script supports.
 * The Google ID token travels in the body, never in the URL.
 */
export async function apiPost<T>(action: string, token: string | null, payload: unknown = {}): Promise<ApiResult<T>> {
  try {
    const url = await getApiUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, payload }),
      cache: "no-store",
      redirect: "follow",
    });
    return parse<T>(res);
  } catch (e) {
    return { ok: false, code: "network", message: e instanceof Error ? e.message : "Tidak dapat terhubung ke server." };
  }
}
