import type { Metadata } from "next";
import { PublicMonthly } from "@/components/public-pages";
export const metadata: Metadata = { title: "Monthly Achievement" };
export default function Page() {
  return <PublicMonthly />;
}
