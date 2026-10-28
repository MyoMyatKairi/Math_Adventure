import { DEFAULT_LOCALE, type Locale } from './locales';
import { en, type MessageKey, type Messages } from './messages/en';
import { my } from './messages/my';
import { th } from './messages/th';

export type { MessageKey, Messages };

export const MESSAGES: Record<Locale, Messages> = { en, my, th };

export type MessageVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: MessageVars) => string;

/**
 * Looks up `key` for `locale` and fills {placeholders}. When `vars.count` is 1
 * and a `<key>_one` entry exists, that form is used. Unknown keys fall back to
 * English, then to the key itself.
 */
export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const catalog = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const oneKey = `${key}_one` as MessageKey;
  const useOne = vars?.count === 1 && oneKey in catalog;
  const template = (useOne ? catalog[oneKey] : catalog[key]) ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function createTranslator(locale: Locale): Translate {
  return (key, vars) => translate(locale, key, vars);
}

/** True when `value` is a catalog key (e.g. a Zod message set to a key). */
export function isMessageKey(value: string): value is MessageKey {
  return value in en;
}
