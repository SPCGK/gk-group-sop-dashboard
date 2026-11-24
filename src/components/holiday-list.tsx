import type { Holiday } from "@/lib/engine";
import { formatDateId, weekday } from "@/lib/engine/dates";
import { Badge } from "./ui";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const CATEGORY_LABEL: Record<string, string> = {
  "National Holiday": "Libur Nasional",
  "Joint Leave": "Cuti Bersama",
  "Company Holiday": "Libur Perusahaan",
  "Other Holiday": "Lainnya",
};

export function HolidayCategoryBadge({ category }: { category: string }) {
  const tone = category === "National Holiday" ? "bad" : category === "Joint Leave" ? "warn" : category === "Company Holiday" ? "brand" : "neutral";
  return <Badge tone={tone}>{CATEGORY_LABEL[category] ?? category}</Badge>;
}

export function HolidayTable({ holidays, actions }: { holidays: Holiday[]; actions?: (h: Holiday) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="px-3 py-2.5 pl-5 text-left font-semibold">Tanggal</th>
            <th className="px-3 py-2.5 text-left font-semibold">Nama</th>
            <th className="px-3 py-2.5 text-left font-semibold">Kategori</th>
            <th className="px-3 py-2.5 text-left font-semibold">Hari kerja?</th>
            <th className="px-3 py-2.5 text-left font-semibold">Sumber</th>
            {actions ? <th className="px-3 py-2.5" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {holidays.map((h) => {
            const wd = weekday(h.holiday_date);
            return (
              <tr key={h.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 pl-5 tabular">
                  <span className="font-medium">{formatDateId(h.holiday_date)}</span>
                  <span className={`block text-xs ${wd === 0 || wd === 6 ? "text-ink-3" : "text-ink-2"}`}>{DAYS[wd]}{wd === 0 || wd === 6 ? " (akhir pekan)" : ""}</span>
                </td>
                <td className="px-3 py-2">
                  {h.holiday_name}
                  {h.description ? <span className="block text-xs text-ink-3">{h.description}</span> : null}
                </td>
                <td className="px-3 py-2"><HolidayCategoryBadge category={h.category} /></td>
                <td className="px-3 py-2 text-xs">
                  {h.exclude_from_working_days ? <Badge tone="bad">Non-kerja</Badge> : <Badge tone="ok">Tetap hari kerja</Badge>}
                </td>
                <td className="max-w-[16rem] px-3 py-2 text-xs text-ink-3">{h.source}</td>
                {actions ? <td className="px-3 py-2 text-right">{actions(h)}</td> : null}
              </tr>
            );
          })}
          {holidays.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-3">Belum ada data hari libur.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
