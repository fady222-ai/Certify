"use client";

import { useI18n } from "@/components/LocaleProvider";

/** Toggles between Arabic and English (also flips RTL/LTR via the provider). */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, dict } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
      className={`rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-surface-2 hover:text-brand-700 ${className}`}
      aria-label="Switch language"
      title={dict.switchTo}
    >
      {dict.switchTo}
    </button>
  );
}
