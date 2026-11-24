import type { Metadata } from "next";
import { PublicHolidays } from "@/components/public-pages";
export const metadata: Metadata = { title: "Kalender Hari Libur" };
export default function Page() {
  return <PublicHolidays />;
}
