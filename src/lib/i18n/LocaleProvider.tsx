"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { en, type Dictionary } from "./en";
import { ar } from "./ar";

type LocaleCode = "en" | "ar";

const DICTIONARIES: Record<LocaleCode, Dictionary> = { en, ar };

interface LocaleContextValue {
  locale: LocaleCode;
  dict: Dictionary;
  dir: "ltr" | "rtl";
  setLocale: (locale: LocaleCode) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<LocaleCode>("en");
  const dict = DICTIONARIES[locale];

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dict, dir: dict.dir, setLocale }),
    [locale, dict],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
