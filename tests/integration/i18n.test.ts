/**
 * Burmese and Thai: the RPCs return text in the requested language, fall back
 * to English, never leak answers through translations, and accept native digits.
 */
import { describe, expect, it } from 'vitest';
import { answerKey, lessonsForLevel, LEVEL_1, user, withTx, wrongAnswer, type StartResult } from './db';

type LocalStart = StartResult & {
  lesson: { title: string; worldTitle: string };
  sections: { title: string; content: { kind: string } }[];
  questions: { id: string; type: string; prompt: string; hint: string | null; options: { id: string; label: string }[] | null }[];
};

const BURMESE = /[က-႟]/;
const THAI = /[฀-๿]/;

describe('translated content', () => {
  it('every content row has Burmese and Thai text', () =>
    withTx(async (tx) => {
      for (const table of ['worlds', 'topics', 'lessons', 'lesson_sections', 'questions', 'badges']) {
        const [row] = await tx.admin<{ missing: number }>(
          `select count(*)::int as missing from public.${table} where not (translations ? 'my' and translations ? 'th')`,
        );
        expect(row!.missing, table).toBe(0);
      }
    }));

  it('start_lesson returns the lesson, sections and questions in the requested language', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const args = { p_child_id: child, p_lesson_id: lesson!.id };

      const en = await tx.rpc<LocalStart>(user(parent), 'start_lesson', args);
      const my = await tx.rpc<LocalStart>(user(parent), 'start_lesson', { ...args, p_locale: 'my' });
      const th = await tx.rpc<LocalStart>(user(parent), 'start_lesson', { ...args, p_locale: 'th' });

      expect(BURMESE.test(my.lesson.title) && BURMESE.test(my.lesson.worldTitle)).toBe(true);
      expect(THAI.test(th.lesson.title) && THAI.test(th.lesson.worldTitle)).toBe(true);
      expect(my.sections.every((s) => BURMESE.test(s.title))).toBe(true);
      expect(my.questions.every((q) => BURMESE.test(q.prompt))).toBe(true);
      expect(th.questions.every((q) => THAI.test(q.prompt))).toBe(true);
      // Same attempt, same questions in the same order: only the text differs.
      expect(my.attemptId).toBe(en.attemptId);
      expect(my.questions.map((q) => q.id)).toEqual(en.questions.map((q) => q.id));
      expect(my.questions.map((q) => q.options?.map((o) => o.id) ?? null)).toEqual(en.questions.map((q) => q.options?.map((o) => o.id) ?? null));
      // No explanation or answer is sent before answering.
      expect(JSON.stringify(my)).not.toMatch(/explanation|answer_data/);
    }));

  it('unknown locales fall back to English', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const en = await tx.rpc<LocalStart>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      const xx = await tx.rpc<LocalStart>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id, p_locale: 'xx' });
      expect(xx.lesson.title).toBe(en.lesson.title);
      expect(xx.questions.map((q) => q.prompt)).toEqual(en.questions.map((q) => q.prompt));
    }));

  it('submit_answer gives hints and explanations in the requested language', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const start = await tx.rpc<LocalStart>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id, p_locale: 'th' });
      const q = start.questions[0]!;
      const key = await answerKey(tx, q.id);
      const first = await tx.rpc<{ hint: string | null }>(user(parent), 'submit_answer', {
        p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: wrongAnswer(key), p_locale: 'th',
      });
      expect(THAI.test(first.hint ?? '')).toBe(true);
      const second = await tx.rpc<{ explanation: string }>(user(parent), 'submit_answer', {
        p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: wrongAnswer(key), p_locale: 'th',
      });
      expect(THAI.test(second.explanation)).toBe(true);
    }));

  it('learner overview and badges are translated', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const o = await tx.rpc<{ worlds: { title: string; lessons: { title: string; topicTitle: string }[] }[]; badges: { title: string }[] }>(
        user(parent), 'get_learner_overview', { p_child_id: child, p_locale: 'my' },
      );
      expect(o.worlds.every((w) => BURMESE.test(w.title) && w.lessons.every((l) => BURMESE.test(l.title) && BURMESE.test(l.topicTitle)))).toBe(true);
      expect(o.badges.every((b) => BURMESE.test(b.title))).toBe(true);
    }));
});

describe('native digits', () => {
  it('a numeric answer typed in Myanmar or Thai digits is scored as correct', () =>
    withTx(async (tx) => {
      const [row] = await tx.admin<{ my: string; th: string; plus: string }>(
        `select private.check_answer('numeric', '{"value":"12"}', null, '၁၂') as my,
                private.check_answer('numeric', '{"value":"12"}', null, '๑๒') as th,
                private.check_answer('numeric', '{"value":"7"}', null, '＋7') as plus`,
      );
      expect(row).toEqual({ my: 'correct', th: 'correct', plus: 'correct' });
    }));
});
