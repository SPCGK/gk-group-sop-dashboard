"use client";
import { useAdminEngine } from "@/components/app-provider";
import { HolidayManager } from "@/components/admin/holiday-manager";
import { PageTitle } from "@/components/ui";

export default function HolidayAdminPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  return (
    <>
      <PageTitle title="Holiday Management" description="Data awal: Google Sheets G91:G108, diverifikasi terhadap SKB 3 Menteri 2027 (18 hari libur nasional + 8 hari cuti bersama)." />
      <HolidayManager holidays={[...eng.input.holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))} />
    </>
  );
}
