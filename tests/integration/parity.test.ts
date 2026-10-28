/**
 * The server (SQL) and client (TypeScript) answer checkers must agree on every
 * input. Learners see instant validation from the TS copy; scoring uses SQL.
 */
import { describe, expect, it } from 'vitest';
import { BADGES, checkAnswer, type QuestionType } from '@math-adventure/shared';
import { withTx } from './db';

const INPUTS = [
  '7', ' 7 ', '+7', '-7', '−7', '- 7', '07', '7.0', '7.', '.5', '0.5', '1/2', '2/4', '1 1/2', '3 / 4', '-3/4',
  '1,000', '1,00', '12,34', '1e3', '0x10', 'abc', '', '   ', '2+2', '1/0', '1 1/0', '--3', '1 2', '７',
  '99999999999999', '0.123456789', '<', '>', '=', '＜', 'a', 'b', 'z', '9'.repeat(33), '＋7',
  // Myanmar and Thai digits
  '၇', '๗', '−၇', '၀.၅', '၁/၂', '၂/၄', '၁ ၁/၂', '၁,၀၀၀', '๐.๕', '๑/๒', '๓/๒', '๑,๐๐๐', '၇๗',
];

const QUESTIONS: { type: QuestionType; answer: { value: string; format?: 'any' | 'decimal' | 'fraction' | 'simplest_fraction' }; options?: { id: string; label: string }[] }[] = [
  { type: 'numeric', answer: { value: '7' } },
  { type: 'numeric', answer: { value: '-7' } },
  { type: 'numeric', answer: { value: '0.5', format: 'decimal' } },
  { type: 'numeric', answer: { value: '1/2', format: 'fraction' } },
  { type: 'numeric', answer: { value: '1/2', format: 'simplest_fraction' } },
  { type: 'numeric', answer: { value: '3/2', format: 'simplest_fraction' } },
  { type: 'numeric', answer: { value: '1000' } },
  { type: 'compare', answer: { value: '<' } },
  { type: 'multiple_choice', answer: { value: 'b' }, options: [{ id: 'a', label: '1' }, { id: 'b', label: '2' }] },
];

const tsResult = (q: (typeof QUESTIONS)[number], input: string) => {
  const r = checkAnswer(q, input);
  return r.status === 'invalid' ? `invalid:${r.reason}` : r.status;
};

describe('answer checker parity (TS vs SQL)', () => {
  it('agrees on a matrix of tricky inputs', () =>
    withTx(async (tx) => {
      const mismatches: string[] = [];
      for (const q of QUESTIONS) {
        for (const input of INPUTS) {
          const [row] = await tx.admin<{ r: string }>('select private.check_answer($1, $2, $3, $4) as r', [
            q.type,
            JSON.stringify(q.answer),
            q.options ? JSON.stringify(q.options) : null,
            input,
          ]);
          const ts = tsResult(q, input);
          if (row!.r !== ts) mismatches.push(`${q.type} ${JSON.stringify(q.answer)} input=${JSON.stringify(input)}: sql=${row!.r} ts=${ts}`);
        }
      }
      expect(mismatches).toEqual([]);
    }));

  it('every seeded answer key checks as correct on the server, and a wrong answer as incorrect', () =>
    withTx(async (tx) => {
      const rows = await tx.admin<{ id: string; ok: string; bad: string }>(`
        select id,
          private.check_answer(question_type, answer_data, options, answer_data ->> 'value') as ok,
          private.check_answer(question_type, answer_data, options,
            case question_type
              when 'compare' then case answer_data ->> 'value' when '<' then '>' else '<' end
              when 'multiple_choice' then (select o ->> 'id' from jsonb_array_elements(options) o where o ->> 'id' <> answer_data ->> 'value' limit 1)
              else case when answer_data ->> 'value' = '999' then '998' else '999' end
            end) as bad
        from public.questions`);
      expect(rows).toHaveLength(225);
      expect(rows.filter((r) => r.ok !== 'correct')).toEqual([]);
      expect(rows.filter((r) => r.bad !== 'incorrect')).toEqual([]);
    }));

  it('badge definitions in the database match the shared package', () =>
    withTx(async (tx) => {
      const rows = await tx.admin<{ key: string; unlock_rule: unknown }>('select key, unlock_rule from public.badges order by display_order');
      expect(rows.map((r) => ({ key: r.key, rule: r.unlock_rule }))).toEqual(BADGES.map((b) => ({ key: b.key, rule: b.rule })));
    }));
});
