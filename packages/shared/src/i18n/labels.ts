import { LEARNING_LEVELS } from '../schemas/forms';
import type { MessageKey, Translate } from './translate';

/** "Level 1" in the reader's language, from a learning level id. Falls back to `fallback`. */
export function levelName(levelId: string, t: Translate, fallback = ''): string {
  const level = LEARNING_LEVELS.find((l) => l.id === levelId);
  return level ? t(`level.${level.key}` as MessageKey) : fallback;
}

/** Age group like "5-7" written with an en dash: "5–7". */
export const ageRange = (ageGroup: string) => ageGroup.replace('-', '–');
