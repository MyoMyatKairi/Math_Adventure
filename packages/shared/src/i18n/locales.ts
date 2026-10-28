/** Supported interface and content languages. English is the source language. */
export const LOCALES = ['en', 'my', 'th'] as const;
export type Locale = (typeof LOCALES)[number];
/** Languages that content is translated into from English. */
export type TranslatedLocale = Exclude<Locale, 'en'>;
export const TRANSLATED_LOCALES: readonly TranslatedLocale[] = ['my', 'th'];

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  my: 'မြန်မာ',
  th: 'ไทย',
};

/** BCP 47 tags for Intl formatting and the html lang attribute. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en',
  my: 'my-MM',
  th: 'th-TH',
};

/** Cookie (web) and storage key (mobile) holding the chosen language. */
export const LOCALE_COOKIE = 'ma_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
