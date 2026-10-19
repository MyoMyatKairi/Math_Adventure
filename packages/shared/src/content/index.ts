import { buildCurriculum } from './model';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';

export * from './model';
export * from './validate';

export const LEVELS = [level1, level2, level3];

/** The full, validated curriculum. Throws if any question fails validation. */
export function curriculum() {
  return buildCurriculum(LEVELS);
}
