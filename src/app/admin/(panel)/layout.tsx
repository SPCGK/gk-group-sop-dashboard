"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { useApp } from "@/components/app-provider";
import { LoadError, Loading } from "@/components/data-state";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { auth, adminData, adminError, refreshAdmin } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "signed-out" || (auth.status === "signed-in" && !auth.isAdmin)) router.replace("/admin/login/");
  }, [auth, router]);
  if (auth.status !== "signed-in" || !auth.isAdmin) return <Loading label="Memeriksa akses…" />;
  return (
    <div className="lg:flex">
      <AdminSidebar email={auth.email ?? ""} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-7">
        {adminData ? children : adminError ? <LoadError message={adminError} onRetry={refreshAdmin} /> : <Loading />}
      </main>
    </div>
  );
}
