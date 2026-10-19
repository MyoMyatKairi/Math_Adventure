import type { AnswerData, QuestionOption } from '../schemas/content';
import { COMPARE_SYMBOLS } from '../schemas/content';
import type { QuestionType } from '../types';
import { normalizeInput, parseExact, parseLearnerNumber, rationalEquals, type ParseError } from './number';

export type InvalidReason = ParseError | 'unknown_option' | 'unknown_symbol' | 'wrong_format';

export type AnswerCheck =
  | { status: 'correct' }
  | { status: 'incorrect' }
  | { status: 'invalid'; reason: InvalidReason };

export interface CheckableQuestion {
  type: QuestionType;
  answer: AnswerData;
  options?: QuestionOption[] | null;
}

/** Question types whose answer is a number typed or picked by the learner. */
export const NUMERIC_TYPES: ReadonlySet<QuestionType> = new Set([
  'numeric',
  'missing_number',
  'pattern',
  'visual_quantity',
]);

const COMPARE_ALIASES: Record<string, (typeof COMPARE_SYMBOLS)[number]> = {
  '<': '<',
  '>': '>',
  '=': '=',
  '＜': '<',
  '＞': '>',
  '＝': '=',
};

/**
 * Checks a learner answer. Mirrors `public.ma_check_answer` on the server, which is
 * the authority for scoring; this copy powers instant client-side input validation
 * and content tests.
 */
export function checkAnswer(question: CheckableQuestion, submitted: string): AnswerCheck {
  if (typeof submitted !== 'string') return { status: 'invalid', reason: 'not_a_number' };
  const expected = question.answer.value;

  if (question.type === 'multiple_choice') {
    const choice = submitted.trim();
    if (!question.options?.some((o) => o.id === choice)) return { status: 'invalid', reason: 'unknown_option' };
    return choice === expected ? { status: 'correct' } : { status: 'incorrect' };
  }

  if (question.type === 'compare') {
    const symbol = COMPARE_ALIASES[normalizeInput(submitted)];
    if (!symbol) return { status: 'invalid', reason: 'unknown_symbol' };
    return symbol === expected ? { status: 'correct' } : { status: 'incorrect' };
  }

  const parsed = parseLearnerNumber(submitted);
  if (!parsed.ok) return { status: 'invalid', reason: parsed.error };
  const formatError = checkFormat(question.answer.format ?? 'any', parsed.value);
  if (formatError) return { status: 'invalid', reason: formatError };
  return rationalEquals(parsed.value, parseExact(expected)) ? { status: 'correct' } : { status: 'incorrect' };
}

/**
 * Client-side check run before submitting, without knowing the answer:
 * catches typos and wrong formats so they never cost a try.
 */
export function precheckInput(
  question: { type: QuestionType; answerFormat?: AnswerData['format']; options?: QuestionOption[] | null },
  submitted: string,
): InvalidReason | null {
  if (question.type === 'multiple_choice' || (question.type === 'visual_quantity' && question.options?.length)) {
    return question.options?.some((o) => o.id === submitted) ? null : 'unknown_option';
  }
  if (question.type === 'compare') {
    return COMPARE_ALIASES[normalizeInput(submitted)] ? null : 'unknown_symbol';
  }
  const parsed = parseLearnerNumber(submitted);
  if (!parsed.ok) return parsed.error;
  return checkFormat(question.answerFormat ?? 'any', parsed.value);
}

function checkFormat(
  format: NonNullable<AnswerData['format']>,
  value: { notation: string; den: bigint; writtenInLowestTerms: boolean },
): InvalidReason | null {
  switch (format) {
    case 'any':
      return null;
    case 'decimal':
      return value.notation === 'integer' || value.notation === 'decimal' ? null : 'wrong_format';
    case 'fraction':
      return value.notation === 'decimal' ? 'wrong_format' : null;
    case 'simplest_fraction':
      if (value.notation === 'decimal') return 'wrong_format';
      if (value.notation === 'integer') return null;
      return value.writtenInLowestTerms ? null : 'wrong_format';
  }
}

/** Friendly message for invalid input. Never reveals the answer. */
export function invalidInputMessage(reason: InvalidReason, format: AnswerData['format'] = 'any'): string {
  switch (reason) {
    case 'empty':
      return 'Type an answer first.';
    case 'too_long':
      return 'That answer is too long. Try a shorter number.';
    case 'divide_by_zero':
      return 'A fraction cannot have 0 on the bottom.';
    case 'unknown_option':
      return 'Pick one of the answers.';
    case 'unknown_symbol':
      return 'Choose <, > or =.';
    case 'wrong_format':
      if (format === 'decimal') return 'Write your answer as a decimal, like 0.5.';
      if (format === 'simplest_fraction') return 'Write your answer as a fraction in its simplest form, like 2/3.';
      return 'Write your answer as a fraction, like 3/4.';
    case 'not_a_number':
    default:
      return 'Type a number, like 7, -3, 2.5 or 3/4.';
  }
}

/** Label for showing the correct answer after a question is finished. */
export function correctAnswerLabel(question: CheckableQuestion): string {
  if (question.type === 'multiple_choice') {
    return question.options?.find((o) => o.id === question.answer.value)?.label ?? question.answer.value;
  }
  return question.answer.value;
}
