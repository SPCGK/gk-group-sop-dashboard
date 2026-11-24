// Timezone-safe date helpers. All dates are handled as ISO "yyyy-mm-dd" strings and
// converted to an integer day number (days since 1970-01-01, UTC) for arithmetic.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
/** Google Sheets / Excel serial day 0 = 1899-12-30 */
const SHEETS_EPOCH_DAY = Date.UTC(1899, 11, 30) / MS_PER_DAY;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Returns a valid ISO date or null (null / empty / malformed input → null). */
export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const v = value.trim().slice(0, 10);
    return isValidIsoDate(v) ? v : null;
  }
  return null;
}

export function toDayNumber(iso: string): number {
  const m = ISO_RE.exec(iso)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY;
}

export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromDayNumber(toDayNumber(iso) + n);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return new Date(toDayNumber(iso) * MS_PER_DAY).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const w = weekday(iso);
  return w === 0 || w === 6;
}

/** Monday of the week containing `iso` (mirrors V6: =M4-WEEKDAY(M4;1)+2). */
export function mondayOf(iso: string): string {
  const w = weekday(iso); // 0..6, Sunday=0
  return addDays(iso, w === 0 ? -6 : 1 - w);
}

export function sheetsSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 120000) return null;
  return fromDayNumber(Math.floor(serial) + SHEETS_EPOCH_DAY);
}

export function isoToSheetsSerial(iso: string): number {
  return toDayNumber(iso) - SHEETS_EPOCH_DAY;
}

/** Today's date in Asia/Jakarta (GK Group head office). */
export function todayJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const ID_MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatDateId(iso: string | null | undefined): string {
  if (!iso || !isValidIsoDate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} ${ID_MONTHS[Number(m) - 1]} ${y}`;
}

export function monthShortId(month: number): string {
  return ID_MONTHS[month - 1] ?? String(month);
}
