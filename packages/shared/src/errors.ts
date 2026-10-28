import type { Locale } from './i18n/locales';
import { translate, type MessageKey } from './i18n/translate';

/** Server error keys raised by the database functions (see supabase/migrations). */
const SERVER_ERRORS = [
  'not_authenticated',
  'child_not_found',
  'lesson_not_available',
  'world_locked',
  'not_daily_challenge',
  'rate_limited',
  'lesson_has_no_questions',
  'attempt_not_found',
  'attempt_closed',
  'question_not_in_attempt',
  'question_already_answered',
  'attempt_incomplete',
  'child_limit_reached',
  'nothing_to_review',
] as const;

/** Turns server error keys into plain guidance. Never shows raw database errors to children. */
export function friendlyError(error: { message?: string } | null | undefined, locale: Locale = 'en'): string {
  const msg = error?.message ?? '';
  for (const key of SERVER_ERRORS) if (msg.includes(key)) return translate(locale, `error.${key}` as MessageKey);
  if (/fetch|network/i.test(msg)) return translate(locale, 'error.network');
  return translate(locale, 'error.generic');
}
