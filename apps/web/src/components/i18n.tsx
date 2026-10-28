'use client';

import { createTranslator, LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale, type Translate } from '@math-adventure/shared';
import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useMemo, useTransition } from 'react';
import { cn } from '@/lib/utils';

const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

/** Language picker. Saves the choice in a cookie and re-renders the page in that language. */
export function LanguageSwitcher({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={cn('inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold', tone === 'dark' ? 'text-white/80' : 'text-ink-soft', className)}>
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
          start(() => router.refresh());
        }}
        className={cn('cursor-pointer rounded-lg bg-transparent py-0.5 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon', tone === 'dark' && 'text-white [&>option]:text-ink')}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
