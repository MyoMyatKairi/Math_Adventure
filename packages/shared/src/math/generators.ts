/**
 * Deterministic question generators. Each generator computes the answer and the
 * explanation from the same numbers, so the method shown always matches the answer.
 * Generators never produce learner-facing randomness at runtime: content is
 * generated once from fixed seeds when the seed file is built.
 */
import type { QuestionDraft, QuestionOption, VisualData } from '../schemas/content';
import { OBJECT_KEYS, SHAPE_KEYS } from '../schemas/content';
import { formatRational, gcd, normalizeRational } from './number';
import type { Rng } from './rng';

export type GeneratedQuestion = Omit<QuestionDraft, 'difficulty' | 'points'>;
type ObjectKey = (typeof OBJECT_KEYS)[number];
type ShapeKey = (typeof SHAPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Shuffled multiple-choice options with the correct label included exactly once. */
export function choices(rng: Rng, correct: string, distractors: string[], count = 4) {
  const unique = [...new Set(distractors.filter((d) => d !== correct))];
  const picked = rng.shuffle(unique).slice(0, count - 1);
  if (picked.length < 1) throw new Error(`Not enough distractors for "${correct}"`);
  const labels = rng.shuffle([correct, ...picked]);
  const options: QuestionOption[] = labels.map((label, i) => ({ id: OPTION_IDS[i]!, label }));
  const answerId = options.find((o) => o.label === correct)!.id;
  return { options, answer: { value: answerId } };
}

/** Number options for visual_quantity questions: the option id is the number itself. */
function numberOptions(rng: Rng, correct: number, min = 0): QuestionOption[] {
  const pool = [correct - 2, correct - 1, correct + 1, correct + 2, correct + 3].filter((n) => n >= min);
  const picked = rng.shuffle(pool).slice(0, 3);
  return rng.shuffle([correct, ...picked]).map((n) => ({ id: String(n), label: String(n) }));
}

function nearbyNumbers(answer: number, min = 0, spread = [1, 2, 10]): string[] {
  const out: number[] = [];
  for (const s of spread) out.push(answer + s, answer - s);
  return out.filter((n) => n >= min && n !== answer).map(String);
}

const PLURAL: Record<ObjectKey, string> = {
  apple: 'apples',
  star: 'stars',
  ball: 'balls',
  fish: 'fish',
  leaf: 'leaves',
  block: 'blocks',
  shell: 'shells',
  balloon: 'balloons',
  cookie: 'cookies',
  flower: 'flowers',
};

const NAMES = ['Mia', 'Leo', 'Ava', 'Noah', 'Zara', 'Sam', 'Ivy', 'Omar', 'Lily', 'Ben', 'Aisha', 'Kai'];

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** Display minus sign for prompts and explanations. */
const MINUS = '−';
const fmt = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));
const paren = (n: number) => (n < 0 ? `(${fmt(n)})` : String(n));

function countList(from: number, to: number): string {
  const nums: number[] = [];
  for (let i = from; i <= to; i++) nums.push(i);
  return nums.join(', ');
}

/** Formats integer hundredths (e.g. 245 -> "2.45"), trimming trailing zeros. */
function hundredths(n: number): string {
  return formatRational({ num: BigInt(n), den: 100n });
}

function frac(n: number, d: number): string {
  const r = normalizeRational({ num: BigInt(n), den: BigInt(d) });
  return r.den === 1n ? r.num.toString() : `${r.num}/${r.den}`;
}

// ---------------------------------------------------------------------------
// Level 1: counting, comparing, adding, subtracting, shapes, patterns, measuring
// ---------------------------------------------------------------------------

export function countObjects(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(p.min, p.max);
  const object = rng.pick(OBJECT_KEYS);
  const groups = n > 10 ? [10, n - 10] : [n];
  const explanation =
    n > 10
      ? `There is a full row of 10 and ${n - 10} more. 10 and ${n - 10} make ${n}, so there are ${n} ${PLURAL[object]}.`
      : `Touch each one as you count: ${countList(1, n)}. The last number you say is how many: ${n}.`;
  return {
    type: 'visual_quantity',
    prompt: `How many ${PLURAL[object]} can you count?`,
    visual: { kind: 'objects', object, groups },
    options: numberOptions(rng, n, 1),
    answer: { value: String(n) },
    explanation,
    hint: n > 10 ? 'Count the full row of 10 first, then count on.' : 'Point to each one as you count.',
  };
}

export function numberWord(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(p.min, Math.min(p.max, 20));
  const word = NUMBER_WORDS[n]!;
  const distractors = nearbyNumbers(n, 0, [1, 2, 10]);
  if (n >= 13 && n <= 19) distractors.push(String((n % 10) * 10)); // e.g. fourteen vs forty
  return {
    type: 'multiple_choice',
    prompt: `Which number is ${word}?`,
    ...choices(rng, String(n), distractors),
    explanation:
      n >= 10
        ? `${capital(word)} is ${n}: 1 ten and ${n - 10} ones.`
        : `${capital(word)} is written as ${n}.`,
    hint: 'Say the numbers out loud as you look at each one.',
  };
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function countSequence(
  rng: Rng,
  p: { minStart: number; maxStart: number; step: number; length?: number; direction?: 'up' | 'down' },
): GeneratedQuestion {
  const length = p.length ?? 5;
  const down = p.direction === 'down';
  let start = rng.int(p.minStart, p.maxStart);
  if (p.step > 1) start = Math.round(start / p.step) * p.step;
  if (down && start - p.step * (length - 1) < 0) start = p.step * (length - 1);
  const items = Array.from({ length }, (_, i) => start + (down ? -1 : 1) * p.step * i);
  const blank = rng.int(1, length - 1);
  const answer = items[blank]!;
  const shown: (number | null)[] = items.map((v, i) => (i === blank ? null : v));
  const before = items[blank - 1]!;
  return {
    type: 'pattern',
    prompt: 'What number is missing from the pattern?',
    visual: { kind: 'sequence', items: shown },
    answer: { value: String(answer) },
    explanation: `The numbers go ${down ? 'down' : 'up'} by ${p.step} each time. ${before} ${down ? MINUS : '+'} ${p.step} = ${answer}.`,
    hint: `How much does each number change by?`,
  };
}

export function numberNeighbour(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(Math.max(p.min, 1), p.max);
  const after = rng.next() < 0.5;
  const answer = after ? n + 1 : n - 1;
  return {
    type: 'numeric',
    prompt: `What number comes just ${after ? 'after' : 'before'} ${n}?`,
    visual: { kind: 'number_line', min: Math.max(0, n - 3), max: n + 3, step: 1, highlight: [n] },
    answer: { value: String(answer) },
    explanation: after
      ? `Counting on one from ${n} gives ${answer}. ${n} + 1 = ${answer}.`
      : `Counting back one from ${n} gives ${answer}. ${n} ${MINUS} 1 = ${answer}.`,
    hint: `Find ${n} on the number line and take one step ${after ? 'right' : 'left'}.`,
  };
}

function compareSymbol(a: number, b: number): '<' | '>' | '=' {
  return a < b ? '<' : a > b ? '>' : '=';
}

export function compareNumbers(rng: Rng, p: { min: number; max: number; objects?: boolean; allowEqual?: boolean }): GeneratedQuestion {
  const a = rng.int(p.min, p.max);
  const equal = p.allowEqual === true && rng.next() < 0.2;
  let b = equal ? a : rng.int(p.min, p.max);
  while (!equal && b === a) b = rng.int(p.min, p.max);
  const symbol = compareSymbol(a, b);
  const object = p.objects ? rng.pick(OBJECT_KEYS) : undefined;
  let explanation: string;
  if (symbol === '=') {
    explanation = `${a} and ${b} are the same amount, so ${a} = ${b}.`;
  } else {
    const [big, small] = a > b ? [a, b] : [b, a];
    const reason =
      big >= 10 && Math.floor(big / 10) !== Math.floor(small / 10)
        ? `Compare the tens first: ${Math.floor(big / 10)} tens is more than ${Math.floor(small / 10)} tens.`
        : big >= 10
          ? `The tens are the same, so compare the ones: ${big % 10} is more than ${small % 10}.`
          : `${big} is more than ${small}.`;
    explanation = `${reason} So ${a} ${symbol} ${b}. The open side of the sign faces the bigger number.`;
  }
  return {
    type: 'compare',
    prompt: object ? 'Which sign makes this true? Compare the groups.' : 'Which sign makes this true?',
    visual: { kind: 'compare', left: String(a), right: String(b), ...(object ? { object } : {}) },
    answer: { value: symbol },
    explanation,
    hint: 'Which number is bigger? The open side of < or > faces the bigger number.',
  };
}

export function orderNumbers(rng: Rng, p: { min: number; max: number; ask: 'biggest' | 'smallest' }): GeneratedQuestion {
  const nums = new Set<number>();
  while (nums.size < 4) nums.add(rng.int(p.min, p.max));
  const list = [...nums];
  const answer = p.ask === 'biggest' ? Math.max(...list) : Math.min(...list);
  const sorted = [...list].sort((x, y) => x - y);
  return {
    type: 'multiple_choice',
    prompt: `Which number is the ${p.ask}?`,
    ...choices(rng, String(answer), list.map(String)),
    explanation: `In order from smallest to biggest: ${sorted.join(', ')}. The ${p.ask} is ${answer}.`,
    hint: 'Put the numbers in order first.',
  };
}

export function addObjects(rng: Rng, p: { maxSum: number }): GeneratedQuestion {
  const a = rng.int(1, p.maxSum - 1);
  const b = rng.int(1, p.maxSum - a);
  const sum = a + b;
  const object = rng.pick(OBJECT_KEYS);
  return {
    type: 'numeric',
    prompt: `${a} ${PLURAL[object]} and ${b} more. How many altogether?`,
    visual: { kind: 'objects', object, groups: [a, b] },
    answer: { value: String(sum) },
    explanation: `Start with ${a} and count on ${b}: ${countList(a + 1, sum)}. So ${a} + ${b} = ${sum}.`,
    hint: `Start at ${a} and count on ${b} more.`,
  };
}

export function addNumberLine(rng: Rng, p: { minSum: number; maxSum: number }): GeneratedQuestion {
  const sum = rng.int(p.minSum, p.maxSum);
  const b = rng.int(2, Math.min(9, sum - 1));
  const a = sum - b;
  return {
    type: 'numeric',
    prompt: `What is ${a} + ${b}?`,
    visual: { kind: 'number_line', min: Math.max(0, a - 2), max: sum + 2, step: 1, highlight: [a], jumps: [{ from: a, to: sum }] },
    answer: { value: String(sum) },
    explanation: `Start at ${a} on the number line and jump ${b} to the right. You land on ${sum}, so ${a} + ${b} = ${sum}.`,
    hint: `Put your finger on ${a} and jump forward ${b}.`,
  };
}

export function missingAddend(rng: Rng, p: { maxSum: number }): GeneratedQuestion {
  const sum = rng.int(4, p.maxSum);
  const a = rng.int(1, sum - 1);
  const missing = sum - a;
  const blankFirst = rng.next() < 0.3;
  const parts = blankFirst ? [null, '+', String(a), '=', String(sum)] : [String(a), '+', null, '=', String(sum)];
  return {
    type: 'missing_number',
    prompt: 'What number goes in the box?',
    visual: { kind: 'equation', parts: parts as Extract<VisualData, { kind: 'equation' }>['parts'] },
    answer: { value: String(missing) },
    explanation: `Count on from ${a} to ${sum}: that is ${missing} steps. So ${blankFirst ? `${missing} + ${a}` : `${a} + ${missing}`} = ${sum}. You can check with ${sum} ${MINUS} ${a} = ${missing}.`,
    hint: `How many more do you need to get from ${a} to ${sum}?`,
  };
}

export function subtractObjects(rng: Rng, p: { max: number }): GeneratedQuestion {
  const a = rng.int(3, p.max);
  const b = rng.int(1, a - 1);
  const left = a - b;
  const object = rng.pick(['cookie', 'apple', 'balloon', 'flower'] as const);
  const verb = { cookie: 'are eaten', apple: 'are eaten', balloon: 'float away', flower: 'are picked' }[object];
  return {
    type: 'numeric',
    prompt: `There are ${a} ${PLURAL[object]}. ${b} ${verb}. How many are left?`,
    visual: { kind: 'objects', object, groups: [a], crossedOut: b },
    answer: { value: String(left) },
    explanation: `Start with ${a} and take away ${b}. Count the ones that are not crossed out: ${left}. So ${a} ${MINUS} ${b} = ${left}.`,
    hint: 'Count the ones that are not crossed out.',
  };
}

export function subtractNumberLine(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const a = rng.int(Math.max(p.min, 4), p.max);
  const b = rng.int(2, Math.min(9, a - 1));
  const r = a - b;
  return {
    type: 'numeric',
    prompt: `What is ${a} ${MINUS} ${b}?`,
    visual: { kind: 'number_line', min: Math.max(0, r - 2), max: a + 2, step: 1, highlight: [a], jumps: [{ from: a, to: r }] },
    answer: { value: String(r) },
    explanation: `Start at ${a} and jump ${b} to the left. You land on ${r}, so ${a} ${MINUS} ${b} = ${r}.`,
    hint: `Start at ${a} and count back ${b}.`,
  };
}

export function addSubStory(rng: Rng, p: { max: number }): GeneratedQuestion {
  const name = rng.pick(NAMES);
  if (rng.next() < 0.5) {
    const a = rng.int(2, p.max - 2);
    const b = rng.int(1, p.max - a);
    const thing = rng.pick(['stickers', 'shells', 'marbles', 'crayons'] as const);
    return {
      type: 'numeric',
      prompt: `${name} has ${a} ${thing}. A friend gives ${name} ${b} more. How many ${thing} does ${name} have now?`,
      answer: { value: String(a + b) },
      explanation: `"Gives more" means add. ${a} + ${b} = ${a + b}, so ${name} has ${a + b} ${thing}.`,
      hint: 'Does the number get bigger or smaller?',
    };
  }
  const a = rng.int(5, p.max);
  const b = rng.int(1, a - 1);
  const thing = rng.pick(['grapes', 'strawberries', 'crackers'] as const);
  return {
    type: 'numeric',
    prompt: `${name} has ${a} ${thing} and eats ${b}. How many ${thing} are left?`,
    answer: { value: String(a - b) },
    explanation: `"Eats" means some are taken away, so subtract. ${a} ${MINUS} ${b} = ${a - b}. There are ${a - b} left.`,
    hint: 'Does the number get bigger or smaller?',
  };
}

const SHAPE_SIDES: Partial<Record<ShapeKey, number>> = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 };

export function shapeSides(rng: Rng): GeneratedQuestion {
  const shape = rng.pick(Object.keys(SHAPE_SIDES) as ShapeKey[]);
  const sides = SHAPE_SIDES[shape]!;
  return {
    type: 'numeric',
    prompt: 'How many straight sides does this shape have?',
    visual: { kind: 'shape', shape },
    answer: { value: String(sides) },
    explanation: `Count each straight edge once, going around the shape: ${countList(1, sides)}. A ${shape} has ${sides} sides.`,
    hint: 'Put a finger on one side and go around the shape.',
  };
}

export function shapeName(rng: Rng): GeneratedQuestion {
  const shape = rng.pick(['circle', 'square', 'triangle', 'rectangle', 'hexagon', 'oval'] as const);
  const facts: Record<string, string> = {
    circle: 'A circle is perfectly round and has no corners.',
    square: 'A square has 4 equal sides and 4 corners.',
    triangle: 'A triangle has 3 sides and 3 corners.',
    rectangle: 'A rectangle has 4 sides and 4 square corners. Its opposite sides are equal, two long and two short.',
    hexagon: 'A hexagon has 6 sides and 6 corners.',
    oval: 'An oval is round like a stretched circle, with no corners.',
  };
  const confusable: Record<string, string[]> = {
    circle: ['oval', 'square', 'triangle'],
    square: ['rectangle', 'triangle', 'circle'],
    triangle: ['square', 'pentagon', 'circle'],
    rectangle: ['square', 'hexagon', 'triangle'],
    hexagon: ['pentagon', 'square', 'circle'],
    oval: ['circle', 'rectangle', 'triangle'],
  };
  return {
    type: 'multiple_choice',
    prompt: 'What is the name of this shape?',
    visual: { kind: 'shape', shape },
    ...choices(rng, shape, confusable[shape]!),
    explanation: facts[shape]!,
    hint: 'Count the sides and corners.',
  };
}

export function shapePattern(rng: Rng, p: { unitLength: 2 | 3 }): GeneratedQuestion {
  const pool: ShapeKey[] = ['circle', 'square', 'triangle', 'star', 'hexagon'];
  const unit = rng.shuffle(pool).slice(0, p.unitLength);
  const length = p.unitLength === 2 ? 6 : 7;
  const full = Array.from({ length }, (_, i) => unit[i % unit.length]!);
  const answer = full[length - 1]!;
  const items: (ShapeKey | null)[] = [...full.slice(0, -1), null];
  const { options, answer: answerData } = choices(rng, answer, pool.filter((s) => s !== answer));
  return {
    type: 'multiple_choice',
    prompt: 'Which shape comes next?',
    visual: { kind: 'shape_sequence', items },
    options: options.map((o) => ({ ...o, visual: { kind: 'shape' as const, shape: o.label as ShapeKey } })),
    answer: answerData,
    explanation: `The pattern repeats ${unit.join(', ')}. After ${full[length - 2]} comes ${answer}.`,
    hint: 'Find the part that repeats. Say it out loud.',
  };
}

export function measureRuler(rng: Rng): GeneratedQuestion {
  const length = rng.int(2, 14);
  const object = rng.pick(['pencil', 'crayon', 'ribbon', 'worm'] as const);
  return {
    type: 'numeric',
    prompt: `How long is the ${object}, in centimetres?`,
    visual: { kind: 'ruler', length, object },
    answer: { value: String(length) },
    explanation: `The ${object} starts at 0 and ends at ${length}, so it is ${length} cm long.`,
    hint: 'Look at where the end of it lines up on the ruler.',
  };
}

// ---------------------------------------------------------------------------
// Level 2: place value, multiplication, division, fractions, time, money
// ---------------------------------------------------------------------------

export function placeValueBlocks(rng: Rng): GeneratedQuestion {
  const h = rng.int(1, 9);
  const t = rng.int(0, 9);
  const o = rng.int(0, 9);
  const n = h * 100 + t * 10 + o;
  // Typical mix-ups: swapped digits, or one ten / one hundred off.
  const pool = [h * 100 + o * 10 + t, o * 100 + t * 10 + h, n + 10, n - 10, n + 100, n - 100].filter(
    (x) => x > 0 && x < 1000 && x !== n,
  );
  return {
    type: 'visual_quantity',
    prompt: 'What number do the blocks show?',
    visual: { kind: 'base_ten', hundreds: h, tens: t, ones: o },
    options: rng
      .shuffle([n, ...rng.shuffle([...new Set(pool)]).slice(0, 3)])
      .map((x) => ({ id: String(x), label: String(x) })),
    answer: { value: String(n) },
    explanation: `${h} hundreds = ${h * 100}, ${t} tens = ${t * 10} and ${o} ones = ${o}. ${h * 100} + ${t * 10} + ${o} = ${n}.`,
    hint: 'Count the hundreds, then the tens, then the ones.',
  };
}

export function digitValue(rng: Rng): GeneratedQuestion {
  // Distinct non-zero digits so "the digit d" is unambiguous.
  const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const n = digits.reduce((acc, d) => acc * 10 + d, 0);
  const pos = rng.int(0, 3); // 0 = thousands
  const d = digits[pos]!;
  const placeNames = ['thousands', 'hundreds', 'tens', 'ones'];
  const value = d * 10 ** (3 - pos);
  const group = (x: number) => x.toLocaleString('en-US');
  const all = [d * 1000, d * 100, d * 10, d].map(group);
  return {
    type: 'multiple_choice',
    prompt: `What is the value of the digit ${d} in ${group(n)}?`,
    ...choices(rng, group(value), all),
    explanation: `The ${d} is in the ${placeNames[pos]} place, so it is worth ${d} ${placeNames[pos]}: ${value.toLocaleString('en-US')}.`,
    hint: 'Name each place from the right: ones, tens, hundreds, thousands.',
  };
}

export function roundNumber(rng: Rng, p: { to: 10 | 100 }): GeneratedQuestion {
  let n = p.to === 10 ? rng.int(11, 99) : rng.int(101, 999);
  if (n % p.to === 0) n += 3;
  const lower = Math.floor(n / p.to) * p.to;
  const upper = lower + p.to;
  const deciding = p.to === 10 ? n % 10 : Math.floor((n % 100) / 10);
  const answer = deciding >= 5 ? upper : lower;
  const digitName = p.to === 10 ? 'ones' : 'tens';
  return {
    type: 'numeric',
    prompt: `Round ${n} to the nearest ${p.to}.`,
    visual: { kind: 'number_line', min: lower, max: upper, step: p.to / 10, highlight: [n] },
    answer: { value: String(answer) },
    explanation: `${n} is between ${lower} and ${upper}. The ${digitName} digit is ${deciding}, which is ${deciding >= 5 ? '5 or more, so round up' : 'less than 5, so round down'} to ${answer}.`,
    hint: `Look at the ${digitName} digit. Is it 5 or more?`,
  };
}

export function arrayMultiply(rng: Rng, p: { maxFactor: number }): GeneratedQuestion {
  const rows = rng.int(2, Math.min(p.maxFactor, 6));
  const cols = rng.int(2, Math.min(p.maxFactor, 8));
  const object = rng.pick(['star', 'apple', 'flower', 'block'] as const);
  const product = rows * cols;
  const counting = Array.from({ length: rows }, (_, i) => cols * (i + 1)).join(', ');
  return {
    type: 'numeric',
    prompt: `There are ${rows} rows with ${cols} ${PLURAL[object]} in each row. How many ${PLURAL[object]} are there?`,
    visual: { kind: 'array', rows, cols, object },
    answer: { value: String(product) },
    explanation: `${rows} rows of ${cols} is ${rows} × ${cols}. Count in ${cols}s: ${counting}. So ${rows} × ${cols} = ${product}.`,
    hint: `Count in ${cols}s, once for each row.`,
  };
}

export function timesTable(rng: Rng, p: { tables: number[]; missing?: boolean }): GeneratedQuestion {
  const t = rng.pick(p.tables);
  const k = rng.int(2, 12);
  const product = t * k;
  if (p.missing) {
    return {
      type: 'missing_number',
      prompt: 'What number goes in the box?',
      visual: { kind: 'equation', parts: [String(t), '×', null, '=', String(product)] },
      answer: { value: String(k) },
      explanation: `Count in ${t}s until you reach ${product}: that takes ${k} steps. So ${t} × ${k} = ${product}. Check: ${product} ÷ ${t} = ${k}.`,
      hint: `How many ${t}s make ${product}?`,
    };
  }
  return {
    type: 'numeric',
    prompt: `What is ${k} × ${t}?`,
    answer: { value: String(product) },
    explanation: `${k} × ${t} means ${k} groups of ${t}. ${multiplyMethod(k, t)} So ${k} × ${t} = ${product}.`,
    hint: `Count in ${t}s, ${k} times.`,
  };
}

function multiplyMethod(k: number, t: number): string {
  if (k <= 5) return `Count in ${t}s: ${Array.from({ length: k }, (_, i) => t * (i + 1)).join(', ')}.`;
  // Split into 5 groups and the rest, which is easier to do in your head.
  return `Split it up: 5 × ${t} = ${5 * t} and ${k - 5} × ${t} = ${(k - 5) * t}. ${5 * t} + ${(k - 5) * t} = ${k * t}.`;
}

export function multiplyStory(rng: Rng, p: { maxFactor: number }): GeneratedQuestion {
  const a = rng.int(2, p.maxFactor);
  const b = rng.int(2, p.maxFactor);
  const name = rng.pick(NAMES);
  const t = rng.pick([
    { box: 'boxes', item: 'pencils' },
    { box: 'bags', item: 'oranges' },
    { box: 'tables', item: 'chairs' },
    { box: 'packs', item: 'stickers' },
  ] as const);
  return {
    type: 'numeric',
    prompt: `${name} has ${a} ${t.box} with ${b} ${t.item} in each. How many ${t.item} are there altogether?`,
    answer: { value: String(a * b) },
    explanation: `There are ${a} equal groups of ${b}, so multiply: ${a} × ${b} = ${a * b}. There are ${a * b} ${t.item}.`,
    hint: 'Equal groups means you can multiply.',
  };
}

export function shareEqually(rng: Rng, p: { maxGroups: number }): GeneratedQuestion {
  const groups = rng.int(2, p.maxGroups);
  const each = rng.int(2, 5);
  const total = groups * each;
  const object = rng.pick(['cookie', 'apple', 'shell', 'balloon'] as const);
  return {
    type: 'numeric',
    prompt: `Share ${total} ${PLURAL[object]} equally between ${groups} friends. How many does each friend get?`,
    ...(total <= 20 ? { visual: { kind: 'objects' as const, object, groups: [total] } } : {}),
    answer: { value: String(each) },
    explanation: `Give one to each friend in turn until they are all gone. ${total} ÷ ${groups} = ${each}, because ${groups} × ${each} = ${total}.`,
    hint: `Which number times ${groups} makes ${total}?`,
  };
}

export function divisionFact(rng: Rng, p: { divisors: number[]; missing?: boolean }): GeneratedQuestion {
  const d = rng.pick(p.divisors);
  const q = rng.int(2, 10);
  const n = d * q;
  if (p.missing) {
    return {
      type: 'missing_number',
      prompt: 'What number goes in the box?',
      visual: { kind: 'equation', parts: [String(n), '÷', null, '=', String(q)] },
      answer: { value: String(d) },
      explanation: `${n} split into groups of the missing number makes ${q}. Since ${q} × ${d} = ${n}, the missing number is ${d}.`,
      hint: `Think: ${q} × what = ${n}?`,
    };
  }
  return {
    type: 'numeric',
    prompt: `What is ${n} ÷ ${d}?`,
    answer: { value: String(q) },
    explanation: `Think of the times table: ${d} × ${q} = ${n}. So ${n} ÷ ${d} = ${q}.`,
    hint: `${d} times what makes ${n}?`,
  };
}

export function divisionStory(rng: Rng, p: { remainder: boolean }): GeneratedQuestion {
  const d = rng.int(3, 6);
  const q = rng.int(3, 8);
  const r = p.remainder ? rng.int(1, d - 1) : 0;
  const n = d * q + r;
  const name = rng.pick(NAMES);
  if (!p.remainder) {
    return {
      type: 'numeric',
      prompt: `${name} puts ${n} books onto ${d} shelves, with the same number on each shelf. How many books go on each shelf?`,
      answer: { value: String(q) },
      explanation: `Sharing equally means divide: ${n} ÷ ${d} = ${q}, because ${d} × ${q} = ${n}.`,
      hint: 'Sharing equally means dividing.',
    };
  }
  return {
    type: 'numeric',
    prompt: `${n} children make teams of ${d}. How many full teams can they make?`,
    answer: { value: String(q) },
    explanation: `${n} ÷ ${d} = ${q} remainder ${r}, because ${d} × ${q} = ${d * q} and ${n} ${MINUS} ${d * q} = ${r}. So there are ${q} full teams and ${r} ${r === 1 ? 'child' : 'children'} left over.`,
    hint: `Count in ${d}s without going past ${n}.`,
  };
}

export function fractionShaded(rng: Rng, p: { maxParts: number }): GeneratedQuestion {
  const parts = rng.int(2, p.maxParts);
  const shaded = rng.int(1, parts - 1);
  const correct = `${shaded}/${parts}`;
  const distractors = [`${parts - shaded}/${parts}`, `${parts}/${shaded}`, `${shaded}/${parts + 1}`, `${shaded}/${parts - shaded}`];
  return {
    type: 'multiple_choice',
    prompt: 'What fraction of the bar is shaded?',
    visual: { kind: 'fraction_bar', parts, shaded },
    ...choices(rng, correct, distractors),
    explanation: `The bar has ${parts} equal parts and ${shaded} ${shaded === 1 ? 'is' : 'are'} shaded. The bottom number is the total parts, the top number is the shaded parts: ${correct}.`,
    hint: 'Count all the parts, then count the shaded parts.',
  };
}

export function fractionOfNumber(rng: Rng, p: { unitOnly: boolean }): GeneratedQuestion {
  const d = rng.pick([2, 3, 4, 5, 10]);
  const unit = rng.int(2, 10);
  const n = d * unit;
  const top = p.unitOnly ? 1 : rng.int(1, d - 1);
  const answer = top * unit;
  return {
    type: 'numeric',
    prompt: `What is ${top}/${d} of ${n}?`,
    answer: { value: String(answer) },
    explanation:
      top === 1
        ? `Split ${n} into ${d} equal groups: ${n} ÷ ${d} = ${unit}. So 1/${d} of ${n} is ${unit}.`
        : `First find 1/${d}: ${n} ÷ ${d} = ${unit}. Then ${top}/${d} is ${top} of those: ${top} × ${unit} = ${answer}.`,
    hint: `Start by dividing ${n} by ${d}.`,
  };
}

export function compareFractions(rng: Rng): GeneratedQuestion {
  if (rng.next() < 0.5) {
    const d = rng.int(4, 10);
    const a = rng.int(1, d - 1);
    let b = rng.int(1, d - 1);
    while (b === a) b = rng.int(1, d - 1);
    const s = compareSymbol(a, b);
    return {
      type: 'compare',
      prompt: 'Which sign makes this true?',
      visual: { kind: 'compare', left: `${a}/${d}`, right: `${b}/${d}` },
      answer: { value: s },
      explanation: `Both fractions have ${d} equal parts. ${Math.max(a, b)} parts is more than ${Math.min(a, b)} parts, so ${a}/${d} ${s} ${b}/${d}.`,
      hint: 'When the bottom numbers match, compare the top numbers.',
    };
  }
  const x = rng.int(2, 9);
  let y = rng.int(2, 9);
  while (y === x) y = rng.int(2, 9);
  const s = compareSymbol(y, x); // 1/x vs 1/y: bigger denominator, smaller piece
  return {
    type: 'compare',
    prompt: 'Which sign makes this true?',
    visual: { kind: 'compare', left: `1/${x}`, right: `1/${y}` },
    answer: { value: s },
    explanation: `When a whole is cut into more parts, each part is smaller. 1/${Math.max(x, y)} is smaller than 1/${Math.min(x, y)}, so 1/${x} ${s} 1/${y}.`,
    hint: 'Would you rather have 1 slice of a cake cut into 2 or into 8?',
  };
}

export function readClock(rng: Rng, p: { minutes: number[] }): GeneratedQuestion {
  const hour = rng.int(1, 12);
  const minute = rng.pick(p.minutes);
  const label = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;
  if (minute % 5 !== 0) throw new Error('readClock minutes must be multiples of 5');
  const next = (hour % 12) + 1;
  const prev = hour === 1 ? 12 : hour - 1;
  const pointsTo = minute === 0 ? 12 : minute / 5;
  const distractors = [
    label(next, minute),
    label(prev, minute),
    label(hour, (minute + 30) % 60),
    // Mixing up the hands: reading the long hand as the hour.
    label(pointsTo, (hour * 5) % 60),
  ];
  const hourPart = minute === 0 ? `The short hand points to ${hour}` : `The short hand is between ${hour} and ${next}`;
  const minutePart =
    minute === 0
      ? `The long hand points to 12, which means exactly ${hour} o'clock.`
      : `The long hand points to ${pointsTo}. Each number is 5 minutes, so that is ${pointsTo} × 5 = ${minute} minutes.`;
  return {
    type: 'multiple_choice',
    prompt: 'What time does the clock show?',
    visual: { kind: 'clock', hour, minute },
    ...choices(rng, label(hour, minute), distractors),
    explanation: `${hourPart}, so the hour is ${hour}. ${minutePart} The time is ${label(hour, minute)}.`,
    hint: 'Read the short hand for the hour, then the long hand for minutes.',
  };
}

export function countCoins(rng: Rng, p: { maxCoins: number }): GeneratedQuestion {
  const n = rng.int(2, p.maxCoins);
  const coins = Array.from({ length: n }, () => rng.pick([1, 5, 10, 25] as const)).sort((a, b) => b - a);
  const total = coins.reduce((s, c) => s + c, 0);
  let running = 0;
  const steps = coins.map((c) => (running += c));
  return {
    type: 'numeric',
    prompt: 'How many cents are there altogether?',
    visual: { kind: 'coins', coins },
    answer: { value: String(total) },
    explanation: `Start with the biggest coin and count on: ${steps.join(', ')}. That is ${total} cents (${total}¢).`,
    hint: 'Start with the biggest coin, then count on.',
  };
}

export function moneyChange(rng: Rng): GeneratedQuestion {
  const paid = rng.pick([50, 100]);
  const cost = rng.int(2, paid / 5 - 1) * 5;
  const name = rng.pick(NAMES);
  const item = rng.pick(['a pencil', 'an apple', 'a sticker', 'a bookmark']);
  return {
    type: 'numeric',
    prompt: `${name} buys ${item} for ${cost}¢ and pays with ${paid}¢. How many cents of change does ${name} get?`,
    answer: { value: String(paid - cost) },
    explanation: `Change is what is left: ${paid} ${MINUS} ${cost} = ${paid - cost}. You can check by counting up from ${cost} to ${paid}. The change is ${paid - cost}¢.`,
    hint: `Count up from ${cost} to ${paid}.`,
  };
}

export function rectanglePerimeter(rng: Rng, p: { max: number; unit: 'cm' | 'm' }): GeneratedQuestion {
  const w = rng.int(2, p.max);
  let h = rng.int(2, p.max);
  if (h === w) h = w + 1;
  const per = 2 * (w + h);
  return {
    type: 'numeric',
    prompt: `What is the perimeter of a rectangle ${w} ${p.unit} long and ${h} ${p.unit} wide?`,
    visual: { kind: 'rectangle', width: w, height: h, unit: p.unit },
    answer: { value: String(per) },
    explanation: `Perimeter is the distance all the way around. Add all four sides: ${w} + ${h} + ${w} + ${h} = ${per} ${p.unit}. That is the same as 2 × (${w} + ${h}).`,
    hint: 'A rectangle has two long sides and two short sides.',
  };
}

// ---------------------------------------------------------------------------
// Level 3: fractions & decimals, percentages, ratios, negatives, area, algebra
// ---------------------------------------------------------------------------

export function fractionToDecimal(rng: Rng): GeneratedQuestion {
  const d = rng.pick([2, 4, 5, 10, 20, 25]);
  let n = rng.int(1, d - 1);
  while (gcd(BigInt(n), BigInt(d)) !== 1n && d !== 10) n = rng.int(1, d - 1);
  const scale = 100 / d;
  const hundredthsValue = n * scale;
  const answer = hundredths(hundredthsValue);
  return {
    type: 'numeric',
    prompt: `Write ${n}/${d} as a decimal.`,
    answer: { value: answer, format: 'decimal' },
    explanation: `Make the bottom number 100: multiply top and bottom by ${scale}. ${n}/${d} = ${hundredthsValue}/100 = ${answer}.`,
    hint: `What do you multiply ${d} by to make 100?`,
  };
}

export function decimalToFraction(rng: Rng): GeneratedQuestion {
  const tenths = rng.pick([2, 4, 5, 6, 8]);
  const value = `0.${tenths}`;
  const g = Number(gcd(BigInt(tenths), 10n));
  const simplest = `${tenths / g}/${10 / g}`;
  return {
    type: 'numeric',
    prompt: `Write ${value} as a fraction in its simplest form.`,
    answer: { value: simplest, format: 'simplest_fraction' },
    explanation: `${value} means ${tenths} tenths: ${tenths}/10. Divide the top and bottom by ${g}: ${tenths}/10 = ${simplest}.`,
    hint: 'Write it as tenths first, then simplify.',
  };
}

export function addFractions(rng: Rng, p: { sameDenominator: boolean }): GeneratedQuestion {
  if (p.sameDenominator) {
    const d = rng.int(5, 12);
    const a = rng.int(1, d - 2);
    const b = rng.int(1, d - a - 1);
    const sum = frac(a + b, d);
    const simplified = sum !== `${a + b}/${d}`;
    return {
      type: 'numeric',
      prompt: `What is ${a}/${d} + ${b}/${d}?`,
      answer: { value: `${a + b}/${d}`, format: 'fraction' },
      explanation: `The bottom numbers are the same, so add the tops: ${a} + ${b} = ${a + b}. The answer is ${a + b}/${d}${simplified ? `, which simplifies to ${sum}` : ''}.`,
      hint: 'Keep the bottom number. Add the top numbers.',
    };
  }
  const small = rng.pick([2, 3, 4, 5]);
  const factor = rng.pick([2, 3]);
  const big = small * factor;
  const a = 1;
  const b = rng.int(1, big - factor - 1);
  const top = a * factor + b;
  const result = frac(top, big);
  return {
    type: 'numeric',
    prompt: `What is ${a}/${small} + ${b}/${big}?`,
    answer: { value: `${top}/${big}`, format: 'fraction' },
    explanation: `Make the bottom numbers the same. 1/${small} = ${factor}/${big}. Then ${factor}/${big} + ${b}/${big} = ${top}/${big}${result !== `${top}/${big}` ? ` = ${result}` : ''}.`,
    hint: `Change 1/${small} into a fraction with ${big} on the bottom.`,
  };
}

export function decimalAddSub(rng: Rng): GeneratedQuestion {
  const a = rng.int(110, 950); // hundredths
  const b = rng.int(10, a - 10);
  const add = rng.next() < 0.5;
  const result = add ? a + b : a - b;
  const op = add ? '+' : MINUS;
  return {
    type: 'numeric',
    prompt: `What is ${hundredths(a)} ${op} ${hundredths(b)}?`,
    answer: { value: hundredths(result), format: 'decimal' },
    explanation: `Line up the decimal points and ${add ? 'add' : 'subtract'} each place: ${(a / 100).toFixed(2)} ${op} ${(b / 100).toFixed(2)} = ${(result / 100).toFixed(2)}, which is ${hundredths(result)}.`,
    hint: 'Write both numbers with two decimal places, then line up the points.',
  };
}

export function decimalPowerOfTen(rng: Rng): GeneratedQuestion {
  const base = rng.int(11, 99); // tenths: 1.1 .. 9.9
  const power = rng.pick([10, 100]);
  const multiply = rng.next() < 0.5;
  const places = power === 10 ? 'one place' : 'two places';
  if (multiply) {
    const value = hundredths(base * 10); // base/10 * power, in hundredths: base*10*power/100
    const result = formatRational(normalizeRational({ num: BigInt(base * power), den: 10n }));
    return {
      type: 'numeric',
      prompt: `What is ${value} × ${power}?`,
      answer: { value: result, format: 'decimal' },
      explanation: `Multiplying by ${power} makes a number ${power} times bigger: each digit moves ${places} to the left. ${value} × ${power} = ${result}.`,
      hint: `Move each digit ${places} to the left.`,
    };
  }
  const result = formatRational(normalizeRational({ num: BigInt(base), den: BigInt(power) }));
  return {
    type: 'numeric',
    prompt: `What is ${base} ÷ ${power}?`,
    answer: { value: result, format: 'decimal' },
    explanation: `Dividing by ${power} makes a number ${power} times smaller: each digit moves ${places} to the right. ${base} ÷ ${power} = ${result}.`,
    hint: `Move each digit ${places} to the right.`,
  };
}

export function percentGrid(rng: Rng): GeneratedQuestion {
  const shaded = rng.int(5, 95);
  return {
    type: 'numeric',
    prompt: 'What percentage of the grid is shaded? Type the number only.',
    visual: { kind: 'percent_grid', shaded },
    answer: { value: String(shaded) },
    explanation: `The grid has 100 squares and ${shaded} are shaded. "Per cent" means "out of 100", so ${shaded} out of 100 is ${shaded}%.`,
    hint: 'Each full row has 10 squares.',
  };
}

export function percentOf(rng: Rng): GeneratedQuestion {
  const pct = rng.pick([10, 20, 25, 30, 50, 75]);
  const base = rng.int(2, 12) * 20;
  const answer = (pct * base) / 100;
  let explanation: string;
  if (pct === 50) explanation = `50% is one half. ${base} ÷ 2 = ${answer}.`;
  else if (pct === 25) explanation = `25% is one quarter. ${base} ÷ 4 = ${answer}.`;
  else if (pct === 75) explanation = `75% is three quarters. One quarter is ${base} ÷ 4 = ${base / 4}, so three quarters is 3 × ${base / 4} = ${answer}.`;
  else if (pct === 10) explanation = `10% means divide by 10. ${base} ÷ 10 = ${answer}.`;
  else explanation = `First find 10%: ${base} ÷ 10 = ${base / 10}. Then ${pct}% is ${pct / 10} × ${base / 10} = ${answer}.`;
  return {
    type: 'numeric',
    prompt: `What is ${pct}% of ${base}?`,
    answer: { value: String(answer) },
    explanation,
    hint: pct % 10 === 0 ? 'Find 10% first by dividing by 10.' : '25% is the same as one quarter.',
  };
}

export function ratioSimplify(rng: Rng): GeneratedQuestion {
  const k = rng.int(2, 4);
  let x = rng.int(1, 4);
  let y = rng.int(1, 5);
  while (x === y || gcd(BigInt(x), BigInt(y)) !== 1n) {
    x = rng.int(1, 4);
    y = rng.int(1, 5);
  }
  const a = x * k;
  const b = y * k;
  const [oa, ob] = rng.shuffle(['apple', 'star', 'fish', 'shell', 'flower'] as const);
  const correct = `${x} : ${y}`;
  return {
    type: 'multiple_choice',
    prompt: `What is the ratio of ${PLURAL[oa!]} to ${PLURAL[ob!]}, in its simplest form?`,
    visual: { kind: 'ratio', a: { object: oa!, count: a }, b: { object: ob!, count: b } },
    ...choices(rng, correct, [`${y} : ${x}`, `${a} : ${b + a}`, `${x} : ${y + 1}`, `${a - 1} : ${b}`]),
    explanation: `There are ${a} ${PLURAL[oa!]} and ${b} ${PLURAL[ob!]}, so the ratio is ${a} : ${b}. Divide both numbers by ${k}: ${a} ÷ ${k} = ${x} and ${b} ÷ ${k} = ${y}. The ratio is ${correct}.`,
    hint: 'Find a number that divides both counts exactly.',
  };
}

export function ratioShare(rng: Rng): GeneratedQuestion {
  let x = rng.int(1, 4);
  let y = rng.int(2, 5);
  while (x === y) y = rng.int(2, 5);
  const parts = x + y;
  const per = rng.int(2, 8);
  const total = parts * per;
  const [n1, n2] = rng.shuffle(NAMES).slice(0, 2);
  const askSecond = rng.next() < 0.5;
  const answer = (askSecond ? y : x) * per;
  return {
    type: 'numeric',
    prompt: `${n1} and ${n2} share ${total} marbles in the ratio ${x} : ${y}. How many marbles does ${askSecond ? n2 : n1} get?`,
    answer: { value: String(answer) },
    explanation: `There are ${x} + ${y} = ${parts} parts. Each part is ${total} ÷ ${parts} = ${per}. ${askSecond ? n2 : n1} gets ${askSecond ? y : x} parts: ${askSecond ? y : x} × ${per} = ${answer}.`,
    hint: 'Add the ratio numbers to find the total number of parts.',
  };
}

export function compareNegatives(rng: Rng): GeneratedQuestion {
  const a = rng.int(-12, 6);
  let b = rng.int(-12, 6);
  while (b === a) b = rng.int(-12, 6);
  if (a >= 0 && b >= 0) b = -b - 1;
  const s = compareSymbol(a, b);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return {
    type: 'compare',
    prompt: 'Which sign makes this true?',
    visual: { kind: 'compare', left: String(a), right: String(b) },
    answer: { value: s },
    explanation: `On a number line, numbers get bigger as you go right. ${fmt(hi)} is to the right of ${fmt(lo)}, so ${fmt(hi)} is greater. That means ${fmt(a)} ${s} ${fmt(b)}.`,
    hint: 'Picture a number line. Which number is further right?',
  };
}

export function negativeArithmetic(rng: Rng, p: { subtractNegative: boolean }): GeneratedQuestion {
  if (p.subtractNegative) {
    const a = rng.int(-8, 8);
    const b = -rng.int(1, 9);
    const r = a - b;
    return {
      type: 'numeric',
      prompt: `What is ${fmt(a)} ${MINUS} ${paren(b)}?`,
      answer: { value: String(r) },
      explanation: `Subtracting a negative number is the same as adding the positive number. ${fmt(a)} ${MINUS} ${paren(b)} = ${fmt(a)} + ${Math.abs(b)} = ${fmt(r)}.`,
      hint: 'Two minus signs together make a plus.',
    };
  }
  const a = rng.int(-10, 5);
  const b = rng.int(2, 12);
  const add = a < 0 ? rng.next() < 0.6 : false;
  const r = add ? a + b : a - b;
  const lo = Math.min(a, r);
  const hi = Math.max(a, r);
  return {
    type: 'numeric',
    prompt: `What is ${fmt(a)} ${add ? '+' : MINUS} ${b}?`,
    visual: { kind: 'number_line', min: lo - 1, max: hi + 1, step: 1, highlight: [a], jumps: [{ from: a, to: r }] },
    answer: { value: String(r) },
    explanation: `Start at ${fmt(a)} on the number line. ${add ? 'Adding' : 'Subtracting'} ${b} means moving ${b} to the ${add ? 'right' : 'left'}. You land on ${fmt(r)}, so ${fmt(a)} ${add ? '+' : MINUS} ${b} = ${fmt(r)}.`,
    hint: `Adding moves right, subtracting moves left.`,
  };
}

export function temperatureStory(rng: Rng): GeneratedQuestion {
  const kind = rng.pick(['rise', 'fall', 'difference'] as const);
  if (kind === 'difference') {
    const high = rng.int(1, 12);
    const low = -rng.int(1, 12);
    const diff = high - low;
    return {
      type: 'numeric',
      prompt: `At noon it was ${high}°C. At midnight it was ${fmt(low)}°C. How many degrees colder was it at midnight?`,
      visual: { kind: 'thermometer', value: low },
      answer: { value: String(diff) },
      explanation: `From ${fmt(low)}°C up to 0°C is ${Math.abs(low)} degrees, and from 0°C up to ${high}°C is ${high} degrees. ${Math.abs(low)} + ${high} = ${diff} degrees.`,
      hint: 'Count up to 0 first, then on to the warmer temperature.',
    };
  }
  const start = rng.int(-8, 6);
  const change = rng.int(3, 12);
  const end = kind === 'rise' ? start + change : start - change;
  return {
    type: 'numeric',
    prompt: `The temperature is ${fmt(start)}°C. It ${kind === 'rise' ? 'rises' : 'falls'} by ${change} degrees. What is the temperature now, in °C?`,
    visual: { kind: 'thermometer', value: start },
    answer: { value: String(end) },
    explanation: `${kind === 'rise' ? 'Rising means add' : 'Falling means subtract'}: ${fmt(start)} ${kind === 'rise' ? '+' : MINUS} ${change} = ${fmt(end)}. The temperature is now ${fmt(end)}°C.`,
    hint: kind === 'rise' ? 'Count up the thermometer.' : 'Count down the thermometer. You may go below zero.',
  };
}

export function rectangleArea(rng: Rng, p: { max: number; grid: boolean }): GeneratedQuestion {
  const w = rng.int(2, p.max);
  const h = rng.int(2, p.max);
  return {
    type: 'numeric',
    prompt: `What is the area of a rectangle ${w} cm long and ${h} cm wide, in cm²?`,
    visual: { kind: 'rectangle', width: w, height: h, unit: 'cm', showGrid: p.grid },
    answer: { value: String(w * h) },
    explanation: `Area = length × width. ${w} × ${h} = ${w * h}, so the area is ${w * h} cm². ${p.grid ? `That is ${h} rows of ${w} squares.` : ''}`.trim(),
    hint: 'Multiply the length by the width.',
  };
}

export function triangleArea(rng: Rng): GeneratedQuestion {
  const base = rng.int(2, 9) * 2;
  const height = rng.int(3, 12);
  const area = (base * height) / 2;
  return {
    type: 'numeric',
    prompt: `A triangle has a base of ${base} cm and a height of ${height} cm. What is its area, in cm²?`,
    visual: { kind: 'triangle', base, height, unit: 'cm' },
    answer: { value: String(area) },
    explanation: `A triangle is half of a rectangle with the same base and height. Area = 1/2 × base × height = 1/2 × ${base} × ${height} = ${area} cm².`,
    hint: 'Find base × height, then halve it.',
  };
}

export function missingSide(rng: Rng): GeneratedQuestion {
  const w = rng.int(2, 9);
  const l = rng.int(3, 12);
  const area = w * l;
  return {
    type: 'numeric',
    prompt: `A rectangle has an area of ${area} cm² and a width of ${w} cm. How long is it, in cm?`,
    answer: { value: String(l) },
    explanation: `Area = length × width, so length = area ÷ width. ${area} ÷ ${w} = ${l} cm. Check: ${l} × ${w} = ${area}.`,
    hint: `Which number times ${w} makes ${area}?`,
  };
}

export function substitute(rng: Rng): GeneratedQuestion {
  const n = rng.int(2, 9);
  const a = rng.int(2, 6);
  const b = rng.int(1, 12);
  const plus = rng.next() < 0.6;
  const value = plus ? a * n + b : a * n - b;
  return {
    type: 'numeric',
    prompt: `If n = ${n}, what is ${a}n ${plus ? '+' : MINUS} ${b}?`,
    answer: { value: String(value) },
    explanation: `${a}n means ${a} × n. Replace n with ${n}: ${a} × ${n} = ${a * n}. Then ${a * n} ${plus ? '+' : MINUS} ${b} = ${fmt(value)}.`,
    hint: `${a}n means ${a} times n.`,
  };
}

export function solveEquation(rng: Rng, p: { twoStep: boolean }): GeneratedQuestion {
  const x = rng.int(2, 12);
  if (!p.twoStep) {
    if (rng.next() < 0.5) {
      const a = rng.int(3, 20);
      return {
        type: 'numeric',
        prompt: `Solve: x + ${a} = ${x + a}. What is x?`,
        answer: { value: String(x) },
        explanation: `Subtract ${a} from both sides to get x on its own: x = ${x + a} ${MINUS} ${a} = ${x}. Check: ${x} + ${a} = ${x + a}.`,
        hint: 'Do the opposite of adding.',
      };
    }
    const a = rng.int(2, 9);
    return {
      type: 'numeric',
      prompt: `Solve: ${a}x = ${a * x}. What is x?`,
      answer: { value: String(x) },
      explanation: `${a}x means ${a} × x. Divide both sides by ${a}: x = ${a * x} ÷ ${a} = ${x}. Check: ${a} × ${x} = ${a * x}.`,
      hint: 'Do the opposite of multiplying.',
    };
  }
  const a = rng.int(2, 6);
  const b = rng.int(1, 15);
  const c = a * x + b;
  return {
    type: 'numeric',
    prompt: `Solve: ${a}x + ${b} = ${c}. What is x?`,
    answer: { value: String(x) },
    explanation: `First subtract ${b} from both sides: ${a}x = ${c} ${MINUS} ${b} = ${a * x}. Then divide both sides by ${a}: x = ${a * x} ÷ ${a} = ${x}. Check: ${a} × ${x} + ${b} = ${c}.`,
    hint: `Undo the + ${b} first, then undo the × ${a}.`,
  };
}

export function multiStepStory(rng: Rng): GeneratedQuestion {
  const name = rng.pick(NAMES);
  const kind = rng.pick(['change', 'packs', 'saving'] as const);
  if (kind === 'change') {
    const price = rng.int(3, 9);
    const qty = rng.int(2, 5);
    const paid = Math.ceil((price * qty + 1) / 10) * 10;
    const change = paid - price * qty;
    return {
      type: 'numeric',
      prompt: `Tickets cost $${price} each. ${name} buys ${qty} tickets and pays with $${paid}. How many dollars of change does ${name} get?`,
      answer: { value: String(change) },
      explanation: `Step 1: total cost = ${qty} × $${price} = $${price * qty}. Step 2: change = $${paid} ${MINUS} $${price * qty} = $${change}.`,
      hint: 'First find the total cost of the tickets.',
    };
  }
  if (kind === 'packs') {
    const per = rng.pick([6, 8, 10, 12]);
    const packs = rng.int(3, 6);
    const used = rng.int(5, per * packs - 5);
    return {
      type: 'numeric',
      prompt: `A class has ${packs} packs of ${per} pencils. They use ${used} pencils. How many pencils are left?`,
      answer: { value: String(per * packs - used) },
      explanation: `Step 1: total pencils = ${packs} × ${per} = ${packs * per}. Step 2: pencils left = ${packs * per} ${MINUS} ${used} = ${packs * per - used}.`,
      hint: 'First work out how many pencils there are altogether.',
    };
  }
  const weekly = rng.int(3, 8);
  const weeks = rng.int(3, 8);
  const spent = rng.int(2, weekly * weeks - 2);
  return {
    type: 'numeric',
    prompt: `${name} saves $${weekly} every week for ${weeks} weeks, then spends $${spent} on a book. How many dollars does ${name} have left?`,
    answer: { value: String(weekly * weeks - spent) },
    explanation: `Step 1: savings = ${weeks} × $${weekly} = $${weekly * weeks}. Step 2: after buying the book, $${weekly * weeks} ${MINUS} $${spent} = $${weekly * weeks - spent}.`,
    hint: 'First find how much was saved altogether.',
  };
}

/** Registry used by the curriculum builder. */
export const GENERATORS = {
  countObjects,
  numberWord,
  countSequence,
  numberNeighbour,
  compareNumbers,
  orderNumbers,
  addObjects,
  addNumberLine,
  missingAddend,
  subtractObjects,
  subtractNumberLine,
  addSubStory,
  shapeSides,
  shapeName,
  shapePattern,
  measureRuler,
  placeValueBlocks,
  digitValue,
  roundNumber,
  arrayMultiply,
  timesTable,
  multiplyStory,
  shareEqually,
  divisionFact,
  divisionStory,
  fractionShaded,
  fractionOfNumber,
  compareFractions,
  readClock,
  countCoins,
  moneyChange,
  rectanglePerimeter,
  fractionToDecimal,
  decimalToFraction,
  addFractions,
  decimalAddSub,
  decimalPowerOfTen,
  percentGrid,
  percentOf,
  ratioSimplify,
  ratioShare,
  compareNegatives,
  negativeArithmetic,
  temperatureStory,
  rectangleArea,
  triangleArea,
  missingSide,
  substitute,
  solveEquation,
  multiStepStory,
} as const;

export type GeneratorName = keyof typeof GENERATORS;
export type GeneratorParams<N extends GeneratorName> = Parameters<(typeof GENERATORS)[N]>[1];
