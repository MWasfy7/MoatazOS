"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export function LocaleSwitch() {
  const { locale, setLocale, dict } = useLocale();
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-800 p-0.5 text-xs">
      <span className="sr-only">{dict.locale_switch.label}</span>
      {(["en", "ar"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`min-h-9 rounded px-2.5 py-1 font-medium ${
            locale === code ? "bg-neutral-800 text-neutral-50" : "text-neutral-400 hover:text-neutral-100"
          }`}
          aria-pressed={locale === code}
        >
          {dict.locale_switch[code]}
        </button>
      ))}
    </div>
  );
}
