"use client";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useAdminEngine } from "@/components/app-provider";
import { DashboardView } from "@/components/dashboard-view";
import { buttonClass } from "@/components/ui";

export default function AdminDashboardPage() {
  const eng = useAdminEngine();
  if (!eng) return null;
  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Link href="/admin/sop/new/" className={buttonClass("secondary", "sm")}><PlusCircle className="size-4" />Add New SOP</Link>
      </div>
      <DashboardView result={eng.result} weights={eng.input.settings.weights} today={eng.input.today} adminLinks />
    </>
  );
}
