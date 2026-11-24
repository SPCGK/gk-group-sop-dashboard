import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm font-semibold text-brand-strong">404</p>
      <h1 className="mt-2 text-xl font-semibold">Halaman tidak ditemukan</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-cat hover:underline">Kembali ke Dashboard</Link>
    </main>
  );
}
