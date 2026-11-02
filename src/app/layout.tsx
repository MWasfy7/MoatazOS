import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoatazOS App Studio",
  description: "SalesOS Command Center — evidence-first, execution-free decision review.",
  // Home-screen install on the phone (iOS reads these; others read the manifest).
  appleWebApp: { capable: true, title: "Donna", statusBarStyle: "black" },
  icons: { icon: "/icons/donna-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
