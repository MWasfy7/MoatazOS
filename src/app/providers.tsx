"use client";

import { useEffect, type ReactNode } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

function HtmlAttributesSync() {
  const { locale, dir } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <HtmlAttributesSync />
      {children}
    </LocaleProvider>
  );
}
