import { describe, expect, it } from 'vitest';
import { checkAnswer, createRng, hashSeed } from '../src';
import { contentId, curriculum, evaluateTokens, validateQuestion, validateTranslations } from '../src/content';
import { GENERATORS, type GeneratedQuestion } from '../src/math/generators';

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    expect(Array.from({ length: 5 }, () => a.int(1, 100))).toEqual(Array.from({ length: 5 }, () => b.int(1, 100)));
  });
  it('different seeds differ', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('generators', () => {
  it('produce identical questions for the same seed', () => {
    const q1 = GENERATORS.addNumberLine(createRng(42), { minSum: 5, maxSum: 20 });
    const q2 = GENERATORS.addNumberLine(createRng(42), { minSum: 5, maxSum: 20 });
    expect(q1).toEqual(q2);
  });

  // Fuzz every generator with many seeds: every output must validate and its
  // expected answer must check as correct.
  const params: Record<string, object> = {
    countObjects: { min: 1, max: 20 },
    numberWord: { min: 0, max: 20 },
    countSequence: { minStart: 0, maxStart: 20, step: 2 },
    numberNeighbour: { min: 1, max: 20 },
    compareNumbers: { min: 1, max: 50, allowEqual: true },
    orderNumbers: { min: -15, max: 50, ask: 'biggest' },
    addObjects: { maxSum: 20 },
    addNumberLine: { minSum: 5, maxSum: 20 },
    missingAddend: { maxSum: 20 },
    subtractObjects: { max: 20 },
    subtractNumberLine: { min: 5, max: 20 },
    addSubStory: { max: 20 },
    shapePattern: { unitLength: 3 },
    roundNumber: { to: 100 },
    arrayMultiply: { maxFactor: 8 },
    timesTable: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], missing: true },
    multiplyStory: { maxFactor: 10 },
    shareEqually: { maxGroups: 6 },
    divisionFact: { divisors: [2, 3, 4, 5, 6, 7, 8, 9], missing: true },
    divisionStory: { remainder: true },
    fractionShaded: { maxParts: 10 },
    fractionOfNumber: { unitOnly: false },
    readClock: { minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] },
    countCoins: { maxCoins: 8 },
    rectanglePerimeter: { max: 20, unit: 'cm' },
    addFractions: { sameDenominator: false },
    negativeArithmetic: { subtractNegative: false },
    rectangleArea: { max: 12, grid: true },
    solveEquation: { twoStep: true },
  };
  for (const [name, fn] of Object.entries(GENERATORS)) {
    it(`${name} always yields valid, self-consistent questions`, () => {
      for (let seed = 0; seed < 200; seed++) {
        const q = (fn as (r: ReturnType<typeof createRng>, p: object) => GeneratedQuestion)(
          createRng(seed),
          params[name] ?? {},
        );
        const draft = { ...q, difficulty: 1 as const, points: 10 };
        expect(validateQuestion(draft), `${name} seed ${seed}: ${JSON.stringify(q)}`).toEqual([]);
        expect(validateTranslations(draft, q.i18n), `${name} seed ${seed}: ${JSON.stringify(q.i18n)}`).toEqual([]);
        expect(checkAnswer(draft, draft.answer.value).status).toBe('correct');
      }
    });
  }
});

describe('validateQuestion catches bad content', () => {
  const ok = {
    type: 'missing_number' as const,
    prompt: 'What goes in the box?',
    visual: { kind: 'equation' as const, parts: ['3', '+', null, '=', '7'] as ('3' | '+' | null | '=' | '7')[] },
    answer: { value: '4' },
    explanation: 'Count on from 3 to 7: 4 steps. So 3 + 4 = 7.',
    difficulty: 1 as const,
    points: 10,
  };
  it('accepts a correct question', () => expect(validateQuestion(ok)).toEqual([]));
  it('rejects a wrong answer key', () => {
    expect(validateQuestion({ ...ok, answer: { value: '5' }, explanation: 'Count on from 3 to 7: 5 steps.' }).join()).toMatch(/equation is false/);
  });
  it('rejects an answer missing from options', () => {
    const q = {
      type: 'multiple_choice' as const,
      prompt: 'Pick one',
      options: [
        { id: 'a', label: '1' },
        { id: 'b', label: '2' },
      ],
      answer: { value: 'c' },
      explanation: 'The answer is 3 because reasons.',
      difficulty: 1 as const,
      points: 10,
    };
    expect(validateQuestion(q).join()).toMatch(/not one of the options/);
  });
  it('rejects wrong compare answers', () => {
    const q = {
      type: 'compare' as const,
      prompt: 'Which sign?',
      visual: { kind: 'compare' as const, left: '3', right: '5' },
      answer: { value: '>' },
      explanation: 'Because 3 > 5 is what we say.',
      difficulty: 1 as const,
      points: 10,
    };
    expect(validateQuestion(q).join()).toMatch(/should be </);
  });
});

describe('evaluateTokens', () => {
  it('respects precedence', () => {
    const r = evaluateTokens(['2', '+', '3', '×', '4']);
    expect(r.num / r.den).toBe(14n);
  });
  it('throws on division by zero', () => {
    expect(() => evaluateTokens(['1', '÷', '0'])).toThrow();
  });
});

describe('curriculum', () => {
  const c = curriculum();
  it('meets minimum size per level', () => {
    for (const levelId of new Set(c.worlds.map((w) => w.levelId))) {
      expect(c.worlds.filter((w) => w.levelId === levelId).length).toBeGreaterThanOrEqual(3);
      const topics = c.topics.filter((t) => t.levelId === levelId);
      expect(topics.length).toBeGreaterThanOrEqual(5);
      for (const t of topics) {
        const lessons = c.lessons.filter((l) => l.topicId === t.id);
        expect(lessons.length).toBeGreaterThanOrEqual(3);
        for (const l of lessons) expect(l.questions.length).toBeGreaterThanOrEqual(5);
      }
    }
    expect(c.lessons.length).toBeGreaterThanOrEqual(45);
    expect(c.lessons.reduce((n, l) => n + l.questions.length, 0)).toBeGreaterThanOrEqual(225);
  });
  it('uses every question type', () => {
    const types = new Set(c.lessons.flatMap((l) => l.questions.map((q) => q.type)));
    expect(types.size).toBe(6);
  });
  it('lessons have all four section types', () => {
    for (const l of c.lessons) expect(l.sections.map((s) => s.type)).toEqual(['introduction', 'worked_example', 'practice', 'summary']);
  });
  it('is deterministic', () => {
    expect(curriculum()).toEqual(c);
  });
  it('ids are unique valid UUIDs', () => {
    const ids = [...c.worlds, ...c.topics, ...c.lessons, ...c.lessons.flatMap((l) => [...l.questions, ...l.sections])].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(contentId('x')).toBe(contentId('x'));
  });
});
