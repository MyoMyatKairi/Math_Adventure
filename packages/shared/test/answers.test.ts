import { describe, expect, it } from 'vitest';
import { checkAnswer, formatRational, parseLearnerNumber, rationalEquals } from '../src';

const numeric = (value: string, format?: 'any' | 'decimal' | 'fraction' | 'simplest_fraction') => ({
  type: 'numeric' as const,
  answer: { value, format },
});

describe('parseLearnerNumber', () => {
  it.each([
    ['7', 7n, 1n, 'integer'],
    ['  12 ', 12n, 1n, 'integer'],
    ['-3', -3n, 1n, 'integer'],
    ['−3', -3n, 1n, 'integer'],
    ['- 3', -3n, 1n, 'integer'],
    ['+4', 4n, 1n, 'integer'],
    ['1,000', 1000n, 1n, 'integer'],
    ['0.5', 5n, 10n, 'decimal'],
    ['.5', 5n, 10n, 'decimal'],
    ['5.', 5n, 1n, 'decimal'],
    ['-2.75', -275n, 100n, 'decimal'],
    ['3/4', 3n, 4n, 'fraction'],
    ['3 / 4', 3n, 4n, 'fraction'],
    ['-7/2', -7n, 2n, 'fraction'],
    ['1 1/2', 3n, 2n, 'mixed'],
    ['-2 1/4', -9n, 4n, 'mixed'],
  ])('parses %j', (input, num, den, notation) => {
    const r = parseLearnerNumber(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(rationalEquals(r.value, { num, den })).toBe(true);
      expect(r.value.notation).toBe(notation);
    }
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'not_a_number'],
    ['1 2', 'not_a_number'],
    ['2+2', 'not_a_number'],
    ['1e5', 'not_a_number'],
    ['1,5', 'not_a_number'],
    ['12,34', 'not_a_number'],
    ['.', 'not_a_number'],
    ['--3', 'not_a_number'],
    ['3/0', 'divide_by_zero'],
    ['1 1/0', 'divide_by_zero'],
    ['0x10', 'not_a_number'],
    ['Infinity', 'not_a_number'],
    ['NaN', 'not_a_number'],
    ['alert(1)', 'not_a_number'],
    ['1'.repeat(40), 'too_long'],
  ])('rejects %j', (input, error) => {
    const r = parseLearnerNumber(input);
    expect(r).toEqual({ ok: false, error });
  });

  it('rejects non-strings', () => {
    expect(parseLearnerNumber(5 as unknown as string).ok).toBe(false);
    expect(parseLearnerNumber(null).ok).toBe(false);
  });
});

describe('checkAnswer: arithmetic', () => {
  it('addition', () => {
    expect(checkAnswer(numeric('12'), '12').status).toBe('correct');
    expect(checkAnswer(numeric('12'), '13').status).toBe('incorrect');
    expect(checkAnswer(numeric('12'), '12.0').status).toBe('correct');
  });
  it('subtraction with negative results', () => {
    expect(checkAnswer(numeric('-5'), '-5').status).toBe('correct');
    expect(checkAnswer(numeric('-5'), '−5').status).toBe('correct');
    expect(checkAnswer(numeric('-5'), '5').status).toBe('incorrect');
  });
  it('multiplication boundaries', () => {
    expect(checkAnswer(numeric('144'), '144').status).toBe('correct');
    expect(checkAnswer(numeric('0'), '0').status).toBe('correct');
    expect(checkAnswer(numeric('0'), '-0').status).toBe('correct');
  });
  it('division with fraction-equivalent input', () => {
    expect(checkAnswer(numeric('4'), '8/2').status).toBe('correct');
    expect(checkAnswer(numeric('0.5'), '1/2').status).toBe('correct');
  });
  it('decimals compare exactly, no floating point error', () => {
    expect(checkAnswer(numeric('0.3'), '0.30').status).toBe('correct');
    expect(checkAnswer(numeric('0.3'), '0.30000001').status).toBe('incorrect');
    expect(checkAnswer(numeric('1/3'), '0.333').status).toBe('incorrect');
  });
});

describe('checkAnswer: answer formats', () => {
  it('decimal format rejects fraction notation as invalid, not wrong', () => {
    expect(checkAnswer(numeric('0.75', 'decimal'), '3/4')).toEqual({ status: 'invalid', reason: 'wrong_format' });
    expect(checkAnswer(numeric('0.75', 'decimal'), '0.75').status).toBe('correct');
  });
  it('fraction format accepts equivalent fractions and integers', () => {
    expect(checkAnswer(numeric('3/4', 'fraction'), '6/8').status).toBe('correct');
    expect(checkAnswer(numeric('1', 'fraction'), '1').status).toBe('correct');
    expect(checkAnswer(numeric('3/4', 'fraction'), '0.75').status).toBe('invalid');
  });
  it('simplest_fraction requires lowest terms', () => {
    expect(checkAnswer(numeric('2/5', 'simplest_fraction'), '2/5').status).toBe('correct');
    expect(checkAnswer(numeric('2/5', 'simplest_fraction'), '4/10')).toEqual({ status: 'invalid', reason: 'wrong_format' });
    expect(checkAnswer(numeric('2/5', 'simplest_fraction'), '3/5').status).toBe('incorrect');
  });
});

describe('checkAnswer: choice and compare', () => {
  const mc = {
    type: 'multiple_choice' as const,
    answer: { value: 'b' },
    options: [
      { id: 'a', label: '1' },
      { id: 'b', label: '2' },
    ],
  };
  it('multiple choice', () => {
    expect(checkAnswer(mc, 'b').status).toBe('correct');
    expect(checkAnswer(mc, 'a').status).toBe('incorrect');
    expect(checkAnswer(mc, 'z')).toEqual({ status: 'invalid', reason: 'unknown_option' });
  });
  it('compare symbols', () => {
    const q = { type: 'compare' as const, answer: { value: '<' } };
    expect(checkAnswer(q, '<').status).toBe('correct');
    expect(checkAnswer(q, '>').status).toBe('incorrect');
    expect(checkAnswer(q, 'less').status).toBe('invalid');
  });
});

describe('formatRational', () => {
  it.each([
    [{ num: 3n, den: 4n }, '0.75'],
    [{ num: -1n, den: 8n }, '-0.125'],
    [{ num: 1n, den: 3n }, '1/3'],
    [{ num: 10n, den: 5n }, '2'],
  ])('%o -> %s', (r, s) => expect(formatRational(r)).toBe(s));
});
