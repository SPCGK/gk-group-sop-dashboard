// Runs the real apps-script/Code.gs + Seed.gs inside a Node VM with in-memory fakes of the
// Google Apps Script services it uses. Lets us test authorization, validation, audit and storage
// round-trips without a Google account.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

type Cell = string | number | boolean | Date | null;

class FakeRange {
  constructor(private sheet: FakeSheet, private r: number, private c: number, private nr: number, private nc: number) {
    if (r + nr - 1 > sheet.maxRows) throw new Error(`Range out of bounds (row ${r + nr - 1} > ${sheet.maxRows})`);
  }
  getValues(): Cell[][] {
    const out: Cell[][] = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.data[this.r - 1 + i] ?? [];
      out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] ?? ""));
    }
    return out;
  }
  setValues(v: Cell[][]) {
    if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) throw new Error("setValues dimension mismatch");
    for (let i = 0; i < this.nr; i++) {
      const idx = this.r - 1 + i;
      while (this.sheet.data.length <= idx) this.sheet.data.push([]);
      for (let j = 0; j < this.nc; j++) {
        const val = v[i][j];
        // With number format "@" Sheets keeps text as-is (no formula / date parsing).
        this.sheet.data[idx][this.c - 1 + j] = this.sheet.textFormat ? (val === null ? "" : typeof val === "string" ? val : String(val)) : val;
      }
    }
    return this;
  }
  setNumberFormat(f: string) {
    if (f === "@") this.sheet.textFormat = true;
    return this;
  }
}

export class FakeSheet {
  data: Cell[][] = [];
  maxRows = 1000;
  textFormat = false;
  frozen = 0;
  constructor(public name: string) {}
  getName() {
    return this.name;
  }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] ?? []).some((c) => c !== "" && c !== null && c !== undefined)) return i + 1;
    return 0;
  }
  getMaxRows() {
    return this.maxRows;
  }
  insertRowsAfter(_after: number, n: number) {
    this.maxRows += n;
  }
  getDataRange() {
    const rows = Math.max(1, this.getLastRow());
    const cols = Math.max(1, ...this.data.slice(0, rows).map((r) => (r ?? []).length));
    return new FakeRange(this, 1, 1, rows, cols);
  }
  getRange(r: number, c: number, nr = 1, nc = 1) {
    return new FakeRange(this, r, c, nr, nc);
  }
  deleteRow(r: number) {
    this.data.splice(r - 1, 1);
  }
  setFrozenRows(n: number) {
    this.frozen = n;
  }
}

export class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>();
  getSheetByName(n: string) {
    return this.sheets.get(n) ?? null;
  }
  insertSheet(n: string) {
    const s = new FakeSheet(n);
    this.sheets.set(n, s);
    return s;
  }
  getSpreadsheetTimeZone() {
    return "Asia/Jakarta";
  }
}

export interface TestIdentity {
  email: string;
  aud?: string;
  email_verified?: string;
  exp?: number;
  iss?: string;
}

export const CLIENT_ID = "1234567890-test.apps.googleusercontent.com";

export function createBackend(opts: { owner?: string; source?: FakeSpreadsheet } = {}) {
  const ss = new FakeSpreadsheet();
  const cache = new Map<string, string>();
  const tokens = new Map<string, TestIdentity>();
  let fetchCount = 0;
  const fmtDate = (d: Date, tz: string) => {
    const offset = tz === "Asia/Jakarta" ? 7 : 0;
    return new Date(d.getTime() + offset * 3600_000).toISOString().slice(0, 10);
  };
  const ctx = {
    console,
    JSON,
    Math,
    Date,
    Number,
    String,
    Object,
    Array,
    isFinite,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: (id: string) => {
        if (!opts.source || id !== "13Sd-CqyoLq9cJVCsUMAj-HVWGoQtG41d4RywBPyMntc") throw new Error("not found");
        return opts.source;
      },
      getUi: () => {
        throw new Error("no ui in tests");
      },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => void cache.set(k, v),
        remove: (k: string) => void cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    UrlFetchApp: {
      fetch: (url: string) => {
        fetchCount++;
        const tok = decodeURIComponent(url.split("id_token=")[1] ?? "");
        const id = tokens.get(tok);
        const body = id
          ? { aud: id.aud ?? CLIENT_ID, email: id.email, email_verified: id.email_verified ?? "true", exp: String(id.exp ?? Math.floor(Date.now() / 1000) + 3600), iss: id.iss ?? "https://accounts.google.com" }
          : { error: "invalid_token" };
        return { getResponseCode: () => (id ? 200 : 400), getContentText: () => JSON.stringify(body) };
      },
    },
    Utilities: {
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_alg: string, s: string) => [...createHash("sha256").update(s).digest()],
      base64EncodeWebSafe: (bytes: number[]) => Buffer.from(bytes).toString("base64url"),
      formatDate: (d: Date, tz: string) => fmtDate(d, tz),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s: string) => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.owner ?? "owner@gankapital.com" }) },
    ScriptApp: { getService: () => ({ getUrl: () => "https://script.google.com/macros/s/TEST/exec" }) },
  };
  vm.createContext(ctx);
  const dir = path.resolve(__dirname, "../../apps-script");
  vm.runInContext(readFileSync(path.join(dir, "Seed.gs"), "utf8"), ctx, { filename: "Seed.gs" });
  vm.runInContext(readFileSync(path.join(dir, "Code.gs"), "utf8"), ctx, { filename: "Code.gs" });
  const g = ctx as unknown as Record<string, (...a: unknown[]) => unknown>;

  const api = {
    ss,
    ctx: g,
    tokens,
    get fetchCount() {
      return fetchCount;
    },
    setup() {
      const msg = g.setupDatabase() as string;
      // configure OAuth client id as the owner would via the menu
      g.setSetting_("oauth_client_id", CLIENT_ID, "test", { email: "owner@gankapital.com" });
      return msg;
    },
    login(email: string, extra: Partial<TestIdentity> = {}) {
      const tok = `tok-${email}-${randomUUID()}`;
      tokens.set(tok, { email, ...extra });
      return tok;
    },
    get(action: string) {
      const out = (g.doGet({ parameter: { action } }) as { getContent(): string }).getContent();
      return JSON.parse(out);
    },
    post(action: string, token: string | null, payload: unknown = {}) {
      return g.handlePost_(JSON.stringify({ action, token, payload })) as { ok: boolean; code?: string; message?: string; errors?: Record<string, string>; data?: any };
    },
    tab(name: string) {
      return ss.getSheetByName(name)!;
    },
  };
  return api;
}
