/**
 * Safe parsing of learner-typed numbers into exact rationals.
 *
 * Accepted notations: integers ("12", "-3", "1,000"), decimals ("0.5", ".5", "-2.75"),
 * fractions ("3/4", "-7/2", "3 / 4") and mixed numbers ("1 1/2"). Myanmar and Thai
 * digits ("၁၂", "๑๒") are read as 0–9.
 * Nothing is ever evaluated as code. The server mirrors these rules in
 * `public.ma_parse_number` (see supabase/migrations) — keep them in sync.
 */

export type Notation = 'integer' | 'decimal' | 'fraction' | 'mixed';

export interface Rational {
  /** Numerator, carries the sign. */
  num: bigint;
  /** Denominator, always positive. */
  den: bigint;
}

export interface ParsedNumber extends Rational {
  notation: Notation;
  /** For fraction/mixed notation: whether the written fraction was already in lowest terms. */
  writtenInLowestTerms: boolean;
}

export type ParseError = 'empty' | 'too_long' | 'not_a_number' | 'divide_by_zero';

export type ParseResult = { ok: true; value: ParsedNumber } | { ok: false; error: ParseError };

export const MAX_INPUT_LENGTH = 32;

const MIXED = /^([+-]?)(\d{1,9}) (\d{1,9})\/(\d{1,9})$/;
const FRACTION = /^([+-]?)(\d{1,9})\/(\d{1,9})$/;
const GROUPED_INTEGER = /^([+-]?)(\d{1,3}(?:,\d{3})+)$/;
const DECIMAL = /^([+-]?)(\d{0,12})(?:\.(\d{0,8}))?$/;

/** 10^n as a BigInt, without the ** operator (some transpilers rewrite it to Math.pow). */
export function pow10(n: number): bigint {
  let r = 1n;
  for (let i = 0; i < n; i++) r *= 10n;
  return r;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function normalizeRational(r: Rational): Rational {
  if (r.den === 0n) throw new Error('Zero denominator');
  const sign = r.den < 0n ? -1n : 1n;
  const g = gcd(r.num, r.den) || 1n;
  return { num: (sign * r.num) / g, den: (sign * r.den) / g };
}

export function rationalEquals(a: Rational, b: Rational): boolean {
  return a.num * b.den === b.num * a.den;
}

export function compareRationals(a: Rational, b: Rational): -1 | 0 | 1 {
  // Denominators are positive, so cross-multiplication preserves order.
  const left = a.num * b.den;
  const right = b.num * a.den;
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Myanmar (၀–၉) and Thai (๐–๙) digits, mapped to 0–9. Mirrored in private.normalize_input. */
const NATIVE_DIGITS = /[၀-၉๐-๙]/g;

export function toAsciiDigits(s: string): string {
  return s.replace(NATIVE_DIGITS, (c) => {
    const code = c.charCodeAt(0);
    return String(code >= 0x1040 ? code - 0x1040 : code - 0x0e50);
  });
}

/** Cleans up typing quirks without changing meaning. */
export function normalizeInput(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/[−‒–—﹣－]/g, '-')
    .replace(/＋/g, '+')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/^([+-]) /, '$1');
}

export function parseLearnerNumber(raw: unknown): ParseResult {
  if (typeof raw !== 'string') return { ok: false, error: 'not_a_number' };
  if (raw.length > MAX_INPUT_LENGTH * 2) return { ok: false, error: 'too_long' };
  const s = normalizeInput(raw);
  if (s.length === 0) return { ok: false, error: 'empty' };
  if (s.length > MAX_INPUT_LENGTH) return { ok: false, error: 'too_long' };

  let m = MIXED.exec(s);
  if (m) {
    const [, sign, whole, n, d] = m as unknown as [string, string, string, string, string];
    const den = BigInt(d);
    if (den === 0n) return { ok: false, error: 'divide_by_zero' };
    const numer = BigInt(whole) * den + BigInt(n);
    return {
      ok: true,
      value: {
        num: sign === '-' ? -numer : numer,
        den,
        notation: 'mixed',
        writtenInLowestTerms: gcd(BigInt(n), den) === 1n && BigInt(n) < den,
      },
    };
  }
  if (s.includes(' ')) return { ok: false, error: 'not_a_number' };

  m = FRACTION.exec(s);
  if (m) {
    const [, sign, n, d] = m as unknown as [string, string, string, string];
    const den = BigInt(d);
    if (den === 0n) return { ok: false, error: 'divide_by_zero' };
    const numer = BigInt(n);
    return {
      ok: true,
      value: {
        num: sign === '-' ? -numer : numer,
        den,
        notation: 'fraction',
        writtenInLowestTerms: gcd(numer, den) === 1n,
      },
    };
  }

  m = GROUPED_INTEGER.exec(s);
  if (m) {
    const [, sign, digits] = m as unknown as [string, string, string];
    const numer = BigInt(digits.replace(/,/g, ''));
    return { ok: true, value: { num: sign === '-' ? -numer : numer, den: 1n, notation: 'integer', writtenInLowestTerms: true } };
  }

  m = DECIMAL.exec(s);
  if (m) {
    const [, sign, intPart = '', fracPart] = m as unknown as [string, string, string | undefined, string | undefined];
    const frac = fracPart ?? '';
    if (intPart.length + frac.length === 0) return { ok: false, error: 'not_a_number' };
    const den = pow10(frac.length);
    const numer = BigInt((intPart || '0') + frac);
    return {
      ok: true,
      value: {
        num: sign === '-' ? -numer : numer,
        den,
        notation: s.includes('.') ? 'decimal' : 'integer',
        writtenInLowestTerms: true,
      },
    };
  }
  return { ok: false, error: 'not_a_number' };
}

/** Parses trusted content (curriculum data). Throws on bad input. */
export function parseExact(text: string): Rational {
  const r = parseLearnerNumber(text);
  if (!r.ok) throw new Error(`Invalid number in content: "${text}" (${r.error})`);
  return normalizeRational(r.value);
}

export function rationalToNumber(r: Rational): number {
  return Number(r.num) / Number(r.den);
}

/** Human-friendly display: integers as-is, terminating decimals as decimals, otherwise a/b. */
export function formatRational(r: Rational): string {
  const n = normalizeRational(r);
  if (n.den === 1n) return n.num.toString();
  let d = n.den;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return `${n.num}/${n.den}`;
  const places = Math.max(twos, fives);
  const scaled = (n.num * pow10(places)) / n.den;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(places + 1, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
