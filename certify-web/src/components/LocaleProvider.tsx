"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getDict, dirFor, fmt, LOCALE_COOKIE, type Dict, type Locale } from "@/lib/i18n";

type LocaleCtx = {
  locale: Locale;
  dict: Dict;
  setLocale: (l: Locale) => void;
  /** Translate via a dot-path key, e.g. t("nav.overview"); optional {vars}. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<LocaleCtx | null>(null);

/** Resolve a dot-path against the dictionary (falls back to the key itself). */
function lookup(dict: Dict, key: string): string {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict);
  return typeof v === "string" ? v : key;
}

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const dict = useMemo(() => getDict(locale), [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      if (l === locale) return;
      // Persist for the server (dynamic root layout reads this cookie).
      document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
      document.documentElement.lang = l;
      document.documentElement.dir = dirFor(l);
      router.refresh(); // re-render server components with the new locale
    },
    [locale, router],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const s = lookup(dict, key);
      return vars ? fmt(s, vars) : s;
    },
    [dict],
  );

  const value = useMemo(() => ({ locale, dict, setLocale, t }), [locale, dict, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}

/** Convenience: just the translate function. */
export function useT() {
  return useI18n().t;
}
