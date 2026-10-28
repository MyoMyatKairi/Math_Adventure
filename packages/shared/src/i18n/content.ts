import type { Locale, TranslatedLocale } from './locales';

/**
 * Shape of the `translations` jsonb column on content tables:
 * `{ "my": { "title": "…" }, "th": { "title": "…" } }`. English lives in the
 * normal columns. Missing translations fall back to English.
 */
export type RowTranslations<T extends Record<string, unknown> = Record<string, unknown>> = Partial<
  Record<TranslatedLocale, Partial<T>>
>;

/** Picks a translated field from a content row, falling back to the English value. */
export function pickTranslation<T>(base: T, translations: unknown, locale: Locale, field: string): T {
  if (locale === 'en' || translations == null || typeof translations !== 'object') return base;
  const forLocale = (translations as Record<string, unknown>)[locale];
  if (forLocale == null || typeof forLocale !== 'object') return base;
  const value = (forLocale as Record<string, unknown>)[field];
  return value === undefined || value === null || value === '' ? base : (value as T);
}
