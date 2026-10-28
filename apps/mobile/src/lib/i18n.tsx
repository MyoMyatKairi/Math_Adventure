import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTranslator, isLocale, LOCALE_COOKIE, type Locale, type Translate } from '@math-adventure/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

/** The device language if it is one we support, e.g. "th-TH" → th. */
function deviceLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().split('-')[0];
    return isLocale(tag) ? tag : 'en';
  } catch {
    return 'en';
  }
}

const Ctx = createContext<LocaleState>({ locale: 'en', setLocale: () => {}, t: createTranslator('en') });

/** Interface and content language. Starts from the device language; a choice in the switcher is remembered. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(LOCALE_COOKIE)
      .then((saved) => {
        if (live && isLocale(saved)) setState(saved);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setState(next);
    AsyncStorage.setItem(LOCALE_COOKIE, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, setLocale, t: createTranslator(locale) }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}

export function useT(): Translate {
  return useContext(Ctx).t;
}
