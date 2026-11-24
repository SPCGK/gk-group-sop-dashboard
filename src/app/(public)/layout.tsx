import { SiteHeader } from "@/components/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-8 text-xs text-ink-3 sm:px-6 no-print">
        GK Group · Strategic Performance Management. Data dihitung oleh calculation engine terpusat sesuai workbook SPC Schedule 2027.
      </footer>
    </>
  );
}
