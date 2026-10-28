import { TRANSLATED_LOCALES, type TranslatedLocale } from '../i18n/locales';
import { checkAnswer } from '../math/answers';
import type { QuestionText } from '../math/generators';
import { compareRationals, parseExact, rationalEquals, type Rational } from '../math/number';
import { questionDraftSchema, sectionContentSchema, type QuestionDraft, type VisualData } from '../schemas/content';

type Token = string | null;

/** Evaluates a fixed-token arithmetic expression with + − × ÷ precedence. No eval. */
export function evaluateTokens(tokens: string[]): Rational {
  const values: Rational[] = [];
  const ops: string[] = [];
  tokens.forEach((t, i) => {
    if (i % 2 === 0) values.push(parseExact(t));
    else if (['+', '-', '×', '÷'].includes(t)) ops.push(t);
    else throw new Error(`Unexpected token ${t}`);
  });
  if (values.length !== ops.length + 1) throw new Error('Malformed expression');
  const mul = (a: Rational, b: Rational): Rational => ({ num: a.num * b.num, den: a.den * b.den });
  const div = (a: Rational, b: Rational): Rational => {
    if (b.num === 0n) throw new Error('Division by zero');
    const sign = b.num < 0n ? -1n : 1n;
    return { num: a.num * b.den * sign, den: a.den * b.num * sign };
  };
  // First pass: × and ÷
  const terms: Rational[] = [values[0]!];
  const addOps: string[] = [];
  ops.forEach((op, i) => {
    const v = values[i + 1]!;
    if (op === '×' || op === '÷') {
      const last = terms.pop()!;
      terms.push(op === '×' ? mul(last, v) : div(last, v));
    } else {
      addOps.push(op);
      terms.push(v);
    }
  });
  return terms.slice(1).reduce<Rational>((acc, v, i) => {
    const sign = addOps[i] === '-' ? -1n : 1n;
    return { num: acc.num * v.den + sign * v.num * acc.den, den: acc.den * v.den };
  }, terms[0]!);
}

function checkEquation(parts: Token[], answer: string): string | null {
  const filled = parts.map((p) => (p === null ? answer : p));
  const eq = filled.indexOf('=');
  if (eq < 1 || filled.lastIndexOf('=') !== eq) return 'equation must have exactly one "="';
  try {
    const left = evaluateTokens(filled.slice(0, eq) as string[]);
    const right = evaluateTokens(filled.slice(eq + 1) as string[]);
    return rationalEquals(left, right) ? null : 'equation is false with the expected answer';
  } catch (e) {
    return `equation could not be evaluated: ${(e as Error).message}`;
  }
}

function checkVisualMatchesAnswer(q: QuestionDraft, v: VisualData): string | null {
  const answer = q.answer.value;
  switch (v.kind) {
    case 'objects': {
      if (q.type !== 'visual_quantity') return null;
      const total = v.groups.reduce((s, g) => s + g, 0) - (v.crossedOut ?? 0);
      return String(total) === answer ? null : `objects show ${total}, answer is ${answer}`;
    }
    case 'base_ten': {
      const total = v.hundreds * 100 + v.tens * 10 + v.ones;
      return String(total) === answer ? null : `blocks show ${total}, answer is ${answer}`;
    }
    case 'equation':
      if (q.type !== 'missing_number') return 'equation visuals are for missing_number questions';
      if (v.parts.filter((p) => p === null).length !== 1) return 'equation needs exactly one blank';
      return checkEquation(v.parts, answer);
    case 'sequence': {
      if (q.type !== 'pattern') return null;
      if (v.items.filter((i) => i === null).length !== 1) return 'sequence needs exactly one blank';
      const filled = v.items.map((i) => (i === null ? Number(answer) : i));
      const step = filled[1]! - filled[0]!;
      return filled.every((n, i) => i === 0 || n - filled[i - 1]! === step) ? null : 'sequence is not a constant-step pattern';
    }
    case 'compare': {
      if (q.type !== 'compare') return 'compare visuals are for compare questions';
      const c = compareRationals(parseExact(v.left), parseExact(v.right));
      const expected = c < 0 ? '<' : c > 0 ? '>' : '=';
      return expected === answer ? null : `compare answer should be ${expected}`;
    }
    case 'fraction_bar':
      return v.shaded <= v.parts ? null : 'more shaded parts than parts';
    case 'percent_grid':
      return null;
    default:
      return null;
  }
}

/** Returns a list of problems; empty means the question is safe to publish. */
export function validateQuestion(q: QuestionDraft): string[] {
  const problems: string[] = [];
  const parsed = questionDraftSchema.safeParse(q);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

  const { type, options, answer } = q;
  if (type === 'multiple_choice') {
    if (!options) problems.push('multiple choice needs options');
  } else if (type === 'visual_quantity') {
    if (!q.visual) problems.push('visual_quantity needs a visual');
    if (options && options.some((o) => o.id !== o.label)) problems.push('visual_quantity option ids must equal labels');
  } else if (options) {
    problems.push(`${type} questions must not have options`);
  }
  if (options) {
    if (new Set(options.map((o) => o.id)).size !== options.length) problems.push('duplicate option ids');
    if (new Set(options.map((o) => o.label)).size !== options.length) problems.push('duplicate option labels');
    const answerIsOption = options.some((o) => o.id === answer.value);
    if (!answerIsOption) problems.push('answer is not one of the options');
  }
  if (type === 'compare' && !q.visual) problems.push('compare needs a compare visual');
  if (type === 'pattern' && q.visual?.kind !== 'sequence') problems.push('pattern needs a sequence visual');
  if (type === 'missing_number' && q.visual?.kind !== 'equation') problems.push('missing_number needs an equation visual');

  // The expected answer must pass the same checker learners are scored with.
  const self = checkAnswer({ type, answer, options }, answer.value);
  if (self.status !== 'correct') problems.push(`expected answer does not check as correct (${JSON.stringify(self)})`);

  if (q.visual) {
    try {
      const p = checkVisualMatchesAnswer(q, q.visual);
      if (p) problems.push(p);
    } catch (e) {
      problems.push(`visual check failed: ${(e as Error).message}`);
    }
  }

  // The explanation must state the correct answer, so learners see the method arrive at it.
  const label =
    type === 'multiple_choice' ? options?.find((o) => o.id === answer.value)?.label ?? answer.value : answer.value;
  const explanation = q.explanation.replace(/−/g, '-');
  if (type !== 'compare' && !explanation.includes(label)) {
    problems.push(`explanation does not mention the answer "${label}"`);
  }
  if (type === 'compare' && !explanation.includes(` ${answer.value} `)) {
    problems.push('explanation does not show the comparison sign');
  }
  return problems;
}

/** The question as a learner sees it in `locale`: translated text, translated word labels. */
export function localizeQuestion(q: QuestionDraft, text: QuestionText): QuestionDraft {
  return {
    ...q,
    prompt: text.prompt,
    explanation: text.explanation,
    ...(q.hint !== undefined ? { hint: text.hint } : {}),
    ...(q.options ? { options: q.options.map((o) => ({ ...o, label: text.options?.[o.id] ?? o.label })) } : {}),
  };
}

/**
 * Checks every translation of a question with the same rules as the English:
 * the translated explanation must still state the answer, word options must be
 * translated, and a hint must exist when the English has one.
 */
export function validateTranslations(q: QuestionDraft, translations: Partial<Record<TranslatedLocale, QuestionText>> | undefined): string[] {
  const problems: string[] = [];
  for (const locale of TRANSLATED_LOCALES) {
    const text = translations?.[locale];
    if (!text) {
      problems.push(`${locale}: missing translation`);
      continue;
    }
    if (q.hint !== undefined && !text.hint) problems.push(`${locale}: missing hint`);
    // Numbers, signs and algebra like "4n + 3" read the same in every language; words do not.
    const words = q.options?.filter((o) => !/^[\d\s.,:/<>=+−×÷nx-]+$/.test(o.label)) ?? [];
    for (const o of words) if (!text.options?.[o.id]) problems.push(`${locale}: option ${o.id} ("${o.label}") is not translated`);
    for (const p of validateQuestion(localizeQuestion(q, text))) problems.push(`${locale}: ${p}`);
  }
  return problems;
}

export function validateSection(content: unknown): string[] {
  const r = sectionContentSchema.safeParse(content);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}
