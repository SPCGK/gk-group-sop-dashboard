import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "SOP Dashboard 2027 · GK Group", template: "%s · GK Group SOP 2027" },
  description: "GK Group – SOP Management & Performance Dashboard 2027",
  icons: { icon: `${base}/gk-mark.png`, apple: `${base}/apple-touch-icon.png` },
};

export const viewport: Viewport = { themeColor: "#d5af26", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh font-sans antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
