import { describe, expect, it } from 'vitest';
import { MESSAGES, translate, type MessageKey } from '../src';
import { en } from '../src/i18n/messages/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogs', () => {
  for (const locale of ['my', 'th'] as const) {
    it(`${locale} uses the same placeholders as English`, () => {
      const mismatched = (Object.keys(en) as MessageKey[]).filter(
        (k) => JSON.stringify(placeholders(MESSAGES[locale][k])) !== JSON.stringify(placeholders(en[k])) &&
          // `_one` forms may write the number out instead of using {count}.
          !(k.endsWith('_one') && placeholders(en[k]).every((p) => p === 'count' || placeholders(MESSAGES[locale][k]).includes(p))),
      );
      expect(mismatched).toEqual([]);
    });
    it(`${locale} has no empty or untranslated English text`, () => {
      const same = (Object.keys(en) as MessageKey[]).filter((k) => !MESSAGES[locale][k].trim() || (/[a-z]{4,}/.test(en[k].replace(/\{\w+\}/g, '')) && MESSAGES[locale][k] === en[k]));
      // Brand-neutral strings that are the same everywhere.
      expect(same.filter((k) => !['common.xp', 'auth.msg.missingConfig', 'input.placeholderDecimal'].includes(k))).toEqual([]);
    });
  }

  it('fills placeholders and picks the singular form', () => {
    expect(translate('en', 'map.finishMore', { count: 1, world: 'Number Forest' })).toBe('Finish 1 more lesson in Number Forest to open.');
    expect(translate('en', 'map.finishMore', { count: 3, world: 'Number Forest' })).toBe('Finish 3 more lessons in Number Forest to open.');
    expect(translate('th', 'player.points', { count: 10 })).toBe('+10 คะแนน');
    expect(translate('my', 'common.today')).toBe('ယနေ့');
  });
});
