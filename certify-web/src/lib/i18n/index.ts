import { ar } from "./ar";
import { en } from "./en";

export type Locale = "ar" | "en";
export const LOCALES: Locale[] = ["ar", "en"];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "certify_locale";

// The Arabic dictionary is the source of truth for the shape.
export type Dict = typeof ar;

const DICTS: Record<Locale, Dict> = { ar, en };

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "ar";
}

export const dirFor = (locale: Locale): "rtl" | "ltr" => (locale === "en" ? "ltr" : "rtl");

/** Simple {placeholder} interpolation for dictionary strings. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
