import type { Metadata } from "next";
import { PublicGantt } from "@/components/public-pages";
export const metadata: Metadata = { title: "Gantt Chart" };
export default function Page() {
  return <PublicGantt />;
}
