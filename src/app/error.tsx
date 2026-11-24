"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-ink-3">{error.message || "Silakan coba lagi."}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm text-white">Coba lagi</button>
    </main>
  );
}
