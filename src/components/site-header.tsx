"use client";
import Link from "next/link";
import { LogIn, LayoutDashboard } from "lucide-react";
import { asset } from "@/lib/api";
import { useApp } from "./app-provider";
import { buttonClass } from "./ui";
import { PublicNav } from "./public-nav";

export function SiteHeader() {
  const { auth } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur no-print">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/gk-mark.png")} alt="GK Group" width={36} height={36} className="size-9 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">GK Group · SOP Dashboard 2027</p>
            <p className="hidden truncate text-xs text-ink-3 sm:block">SOP Management &amp; Performance Dashboard</p>
          </div>
        </Link>
        <div className="order-3 w-full sm:order-none sm:ml-auto sm:w-auto">
          <PublicNav />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {auth.isAdmin ? (
            <Link href="/admin/" className={buttonClass("primary", "sm")}>
              <LayoutDashboard className="size-4" aria-hidden /> <span className="hidden sm:inline">Admin Panel</span>
            </Link>
          ) : (
            <Link href="/admin/login/" className={buttonClass("outline", "sm")}>
              <LogIn className="size-4" aria-hidden /> <span className="hidden sm:inline">Login Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
