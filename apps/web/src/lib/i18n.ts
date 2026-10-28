import 'server-only';
import { createTranslator, isLocale, LOCALE_COOKIE, type Locale, type Translate } from '@math-adventure/shared';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

/** Picks a supported language from an Accept-Language header, e.g. "th-TH,th;q=0.9,en;q=0.8". */
function fromAcceptLanguage(header: string | null): Locale | null {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0]!.trim().toLowerCase().split('-')[0];
    if (isLocale(tag)) return tag;
  }
  return null;
}

/** The visitor's language: the switcher's cookie, else the browser's preference, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return fromAcceptLanguage((await headers()).get('accept-language')) ?? 'en';
});

export const getT = cache(async (): Promise<Translate> => createTranslator(await getLocale()));
