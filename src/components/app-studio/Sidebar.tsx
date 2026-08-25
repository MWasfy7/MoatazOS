"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface ModuleEntry {
  key: "salesos" | "performanceos" | "revenueos" | "analyticsos" | "jarvis";
  href: string;
  implemented: boolean;
}

const MODULES: ModuleEntry[] = [
  { key: "salesos", href: "/app-studio/salesos", implemented: true },
  { key: "performanceos", href: "#", implemented: false },
  { key: "revenueos", href: "#", implemented: false },
  { key: "analyticsos", href: "#", implemented: false },
  { key: "jarvis", href: "#", implemented: false },
];

/**
 * The App Studio product sidebar. Only SalesOS is a real, clickable
 * destination in this milestone - every other module is clearly
 * labeled as a future module, never a disguised dead link.
 */
export function Sidebar() {
  const { dict } = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={dict.appStudio.title} className="flex flex-col gap-1 p-3">
      {MODULES.map((mod) => {
        const active = pathname?.startsWith(mod.href) && mod.implemented;
        if (!mod.implemented) {
          return (
            <div
              key={mod.key}
              className="flex min-h-11 cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-600"
              aria-disabled="true"
            >
              <span>{dict.appStudio.modules[mod.key]}</span>
              <span className="rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                {dict.appStudio.futureModule}
              </span>
            </div>
          );
        }
        return (
          <Link
            key={mod.key}
            href={mod.href}
            className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-neutral-800 text-neutral-50" : "text-neutral-300 hover:bg-neutral-900 hover:text-neutral-50"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {dict.appStudio.modules[mod.key]}
          </Link>
        );
      })}
    </nav>
  );
}
