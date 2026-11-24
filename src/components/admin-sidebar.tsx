"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Building2, CalendarDays, ClipboardList, FileSpreadsheet, GanttChartSquare, History, LayoutDashboard,
  ListChecks, Menu, PlusCircle, Settings, X, LogOut, ExternalLink, UserCircle,
} from "lucide-react";
import { cn } from "./ui";
import { asset } from "@/lib/api";
import { useApp } from "./app-provider";

const MENU = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sop", label: "SOP Management", icon: ListChecks },
  { href: "/admin/sop/new", label: "Add New SOP", icon: PlusCircle },
  { href: "/admin/gantt", label: "Gantt Chart", icon: GanttChartSquare },
  { href: "/admin/monthly", label: "Monthly Achievement", icon: BarChart3 },
  { href: "/admin/organizations", label: "Organization Management", icon: Building2 },
  { href: "/admin/master-sop", label: "Master SOP", icon: ClipboardList },
  { href: "/admin/holidays", label: "Holiday Management", icon: CalendarDays },
  { href: "/admin/reports", label: "Reports & Export", icon: FileSpreadsheet },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/audit-log", label: "Audit Log", icon: History },
];

function isActive(rawPath: string, href: string) {
  const path = rawPath.replace(/\/$/, "") || "/";
  if (href === "/admin") return path === "/admin";
  if (href === "/admin/sop") return path === "/admin/sop" || path === "/admin/sop/edit";
  return path === href || path.startsWith(href + "/");
}

export function AdminSidebar({ email }: { email: string }) {
  const path = usePathname();
  const { signOut } = useApp();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3" aria-label="Menu admin">
      {MENU.map((m) => {
        const active = isActive(path, m.href);
        const Icon = m.icon;
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-soft text-ink ring-1 ring-inset ring-[#ecd88f]" : "text-ink-2 hover:bg-canvas hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-brand-strong" : "text-ink-3")} aria-hidden />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-line p-3 text-xs">
      <p className="flex items-center gap-2 px-2 py-1.5 text-ink-2">
        <UserCircle className="size-4 shrink-0" aria-hidden /> <span className="truncate">{email}</span>
      </p>
      <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-ink-2 hover:bg-canvas">
        <ExternalLink className="size-4" aria-hidden /> Dashboard publik
      </Link>
      <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-bad hover:bg-red-50">
        <LogOut className="size-4" aria-hidden /> Logout
      </button>
    </div>
  );
  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-4 py-3.5">
      <img src={asset("/gk-mark.png")} alt="GK Group" width={32} height={32} className="size-8" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">GK Group SOP 2027</p>
        <p className="text-[11px] text-ink-3">Administrator</p>
      </div>
    </Link>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-white px-3 py-2 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-canvas" aria-label="Buka menu">
          <Menu className="size-5" />
        </button>
        <img src={asset("/gk-mark.png")} alt="" width={28} height={28} className="size-7" />
        <span className="text-sm font-semibold">Admin · SOP 2027</span>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center">
              {brand}
              <button type="button" onClick={() => setOpen(false)} className="ml-auto mr-3 rounded-md p-2 hover:bg-canvas" aria-label="Tutup menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}
