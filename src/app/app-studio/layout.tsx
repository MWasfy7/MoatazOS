"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Sidebar } from "@/components/app-studio/Sidebar";
import { LocaleSwitch } from "@/components/app-studio/LocaleSwitch";
import { DemoModeBadge } from "@/components/shared/DemoModeBadge";

export default function AppStudioLayout({ children }: { children: ReactNode }) {
  const { dict } = useLocale();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-neutral-900 md:w-60 md:shrink-0 md:border-b-0 md:border-e">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">
            {dict.appStudio.title}
          </span>
        </div>
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/90 px-4 py-3 backdrop-blur">
          <DemoModeBadge />
          <LocaleSwitch />
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
