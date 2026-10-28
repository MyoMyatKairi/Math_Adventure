import { buildCurriculum } from './model';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { my } from './translations/my';
import { th } from './translations/th';

export * from './model';
export * from './translation';
export * from './validate';

export const LEVELS = [level1, level2, level3];

/** Burmese and Thai curriculum text, keyed by content key. */
export const CONTENT_TRANSLATIONS = { my, th };

/** The full, validated curriculum in every language. Throws if any question or translation fails validation. */
export function curriculum() {
  return buildCurriculum(LEVELS, CONTENT_TRANSLATIONS);
}
