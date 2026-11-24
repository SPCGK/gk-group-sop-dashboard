"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/gantt/", label: "Gantt" },
  { href: "/monthly/", label: "Monthly" },
  { href: "/holidays/", label: "Kalender" },
];

export function PublicNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto text-sm" aria-label="Navigasi utama">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href.replace(/\/$/, ""));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap",
              active ? "bg-brand-soft text-ink" : "text-ink-3 hover:bg-canvas hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
