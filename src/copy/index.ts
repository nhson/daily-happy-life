"use client";

/**
 * Copy dictionaries — one per language, same shape. `vi` is the default (SPEC §2).
 * Components read strings with `useCopy()`; a missing translation fails the typecheck.
 */
import { useStore } from "@/data/store";
import { en } from "./en";
import { vi } from "./vi";

export type Locale = "vi" | "en";
export const LOCALES: readonly Locale[] = ["vi", "en"];
export const DEFAULT_LOCALE: Locale = "vi";
/** BCP 47 tag for Intl date and number formatting. */
export const LOCALE_TAG: Record<Locale, string> = { vi: "vi-VN", en: "en-GB" };
/** Each language named in itself, for the Settings switch. */
export const LOCALE_NAME: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

/** The English dictionary's shape with literal strings widened, so other languages can fill it. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;
export type Copy = Widen<typeof en>;

const dictionaries: Record<Locale, Copy> = { en, vi };

export function copyFor(locale: Locale): Copy {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function useLocale(): Locale {
  return useStore().state.settings.locale ?? DEFAULT_LOCALE;
}

export function useCopy(): Copy {
  return copyFor(useLocale());
}

/** Dates in the user's language, e.g. "Thứ Tư, 4 thg 11" / "Wednesday 4 Nov". */
export function useFormatDate() {
  const tag = LOCALE_TAG[useLocale()];
  return (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, options).format(date);
}
