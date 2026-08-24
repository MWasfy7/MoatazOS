"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface DrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A generic inspection drawer: a focus-trapped, keyboard-dismissible
 * panel pinned to whatever snapshot is currently rendered. This is
 * inspection, not action - it never contains a form control that
 * writes, sends, or approves anything.
 */
export function Drawer({ title, open, onClose, children }: DrawerProps) {
  const { dict } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-full max-w-md overflow-y-auto border-s border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-base font-semibold text-neutral-50">{title}</h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
            aria-label={dict.inspectionRail.close}
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
