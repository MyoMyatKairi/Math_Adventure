/**
 * Deterministic question generators. Each generator computes the answer and the
 * explanation from the same numbers, so the method shown always matches the answer.
 * Generators never produce learner-facing randomness at runtime: content is
 * generated once from fixed seeds when the seed file is built.
 *
 * Every text is written in English, Burmese and Thai from the same numbers
 * (see `T`). The Burmese and Thai text is a draft for native-speaker review.
 */
import type { Locale, TranslatedLocale } from '../i18n/locales';
import type { QuestionDraft, QuestionOption, VisualData } from '../schemas/content';
import { OBJECT_KEYS, SHAPE_KEYS } from '../schemas/content';
import { formatRational, gcd, normalizeRational } from './number';
import type { Rng } from './rng';
import { numberToWords } from './words';

/** Learner-facing text of one question in a translated language. */
export interface QuestionText {
  prompt: string;
  explanation: string;
  hint?: string;
  /** Option labels by option id, only for options whose label is a word. */
  options?: Record<string, string>;
}

export type GeneratedQuestion = Omit<QuestionDraft, 'difficulty' | 'points'> & {
  i18n?: Partial<Record<TranslatedLocale, QuestionText>>;
};
type ObjectKey = (typeof OBJECT_KEYS)[number];
type ShapeKey = (typeof SHAPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** One text in every language. */
type Tri = Record<Locale, string>;
const T = (en: string, my: string, th: string): Tri => ({ en, my, th });

interface Draft extends Omit<GeneratedQuestion, 'prompt' | 'explanation' | 'hint' | 'i18n'> {
  prompt: Tri;
  explanation: Tri;
  hint?: Tri;
  /** Word labels by option id. Number labels are the same in every language. */
  optionText?: Record<string, Tri>;
}

/** Splits a three-language draft into the English question plus its translations. */
function q(d: Draft): GeneratedQuestion {
  const { prompt, explanation, hint, optionText, ...rest } = d;
  const text = (l: TranslatedLocale): QuestionText => ({
    prompt: prompt[l],
    explanation: explanation[l],
    ...(hint ? { hint: hint[l] } : {}),
    ...(optionText ? { options: Object.fromEntries(Object.entries(optionText).map(([id, t]) => [id, t[l]])) } : {}),
  });
  return {
    ...rest,
    prompt: prompt.en,
    explanation: explanation.en,
    ...(hint ? { hint: hint.en } : {}),
    i18n: { my: text('my'), th: text('th') },
  };
}

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

/** Countable things: English plural, plus Burmese and Thai nouns with their counter words. */
const NOUN: Record<ObjectKey, { en: string; my: string; myC: string; th: string; thC: string }> = {
  apple: { en: 'apples', my: 'ပန်းသီး', myC: 'လုံး', th: 'แอปเปิล', thC: 'ผล' },
  star: { en: 'stars', my: 'ကြယ်', myC: 'ပွင့်', th: 'ดาว', thC: 'ดวง' },
  ball: { en: 'balls', my: 'ဘောလုံး', myC: 'လုံး', th: 'ลูกบอล', thC: 'ลูก' },
  fish: { en: 'fish', my: 'ငါး', myC: 'ကောင်', th: 'ปลา', thC: 'ตัว' },
  leaf: { en: 'leaves', my: 'သစ်ရွက်', myC: 'ရွက်', th: 'ใบไม้', thC: 'ใบ' },
  block: { en: 'blocks', my: 'တုံးလေး', myC: 'တုံး', th: 'บล็อก', thC: 'ก้อน' },
  shell: { en: 'shells', my: 'ခရုခွံ', myC: 'ခု', th: 'เปลือกหอย', thC: 'อัน' },
  balloon: { en: 'balloons', my: 'ပူဖောင်း', myC: 'လုံး', th: 'ลูกโป่ง', thC: 'ลูก' },
  cookie: { en: 'cookies', my: 'ကွတ်ကီး', myC: 'ခု', th: 'คุกกี้', thC: 'ชิ้น' },
  flower: { en: 'flowers', my: 'ပန်း', myC: 'ပွင့်', th: 'ดอกไม้', thC: 'ดอก' },
};
/** "5 apples" in each language: Burmese and Thai put the number after the noun, then a counter. */
const myCount = (o: ObjectKey, n: number) => `${NOUN[o].my} ${n} ${NOUN[o].myC}`;
const thCount = (o: ObjectKey, n: number) => `${NOUN[o].th} ${n} ${NOUN[o].thC}`;

/** Names are picked by position, so each language gets a familiar name in the same slot. */
const NAMES: Tri[] = [
  T('Mia', 'မေ', 'มะลิ'),
  T('Leo', 'အောင်', 'ต้น'),
  T('Ava', 'သီရိ', 'ฝน'),
  T('Noah', 'ကျော်', 'ภูมิ'),
  T('Zara', 'နန္ဒာ', 'แพรว'),
  T('Sam', 'ဇော်', 'บอส'),
  T('Ivy', 'အိ', 'ใบเตย'),
  T('Omar', 'မင်း', 'กล้า'),
  T('Lily', 'လှိုင်', 'น้ำ'),
  T('Ben', 'ထက်', 'เก่ง'),
  T('Aisha', 'စု', 'ขวัญ'),
  T('Kai', 'ကောင်း', 'โอ๊ต'),
];

const SHAPE_NAME: Record<ShapeKey, Tri> = {
  circle: T('circle', 'စက်ဝိုင်း', 'วงกลม'),
  square: T('square', 'စတုရန်း', 'สี่เหลี่ยมจัตุรัส'),
  triangle: T('triangle', 'တြိဂံ', 'สามเหลี่ยม'),
  rectangle: T('rectangle', 'ထောင့်မှန်စတုဂံ', 'สี่เหลี่ยมผืนผ้า'),
  pentagon: T('pentagon', 'ပဉ္စဂံ', 'ห้าเหลี่ยม'),
  hexagon: T('hexagon', 'ဆဋ္ဌဂံ', 'หกเหลี่ยม'),
  oval: T('oval', 'ဘဲဥပုံ', 'วงรี'),
  star: T('star', 'ကြယ်ပုံ', 'รูปดาว'),
};

/** Translations for options whose labels are shape names. */
const shapeOptionText = (options: QuestionOption[]) =>
  Object.fromEntries(options.map((o) => [o.id, SHAPE_NAME[o.label as ShapeKey]]));

const SIGN_PROMPT = T('Which sign makes this true?', 'ဘယ်သင်္ကေတက ဒါကို မှန်စေလဲ။', 'เครื่องหมายใดทำให้ถูกต้อง');
const BOX_PROMPT = T('What number goes in the box?', 'အကွက်ထဲမှာ ဘယ်ဂဏန်း ဝင်မလဲ။', 'ตัวเลขใดอยู่ในกล่อง');
const wh = (en: string, my: string, th: string) => T(`What is ${en}?`, `${my} က ဘယ်လောက်လဲ။`, `${th} เท่ากับเท่าไร`);

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

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Level 1: counting, comparing, adding, subtracting, shapes, patterns, measuring
// ---------------------------------------------------------------------------

export function countObjects(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(p.min, p.max);
  const object = rng.pick(OBJECT_KEYS);
  const groups = n > 10 ? [10, n - 10] : [n];
  const N = NOUN[object];
  const list = countList(1, n);
  return q({
    type: 'visual_quantity',
    prompt: T(`How many ${N.en} can you count?`, `${N.my} ဘယ်နှ${N.myC} ရေတွက်နိုင်လဲ။`, `นับ${N.th}ได้กี่${N.thC}`),
    visual: { kind: 'objects', object, groups },
    options: numberOptions(rng, n, 1),
    answer: { value: String(n) },
    explanation:
      n > 10
        ? T(
            `There is a full row of 10 and ${n - 10} more. 10 and ${n - 10} make ${n}, so there are ${n} ${N.en}.`,
            `10 ပြည့်တဲ့ အတန်းတစ်တန်းနဲ့ နောက်ထပ် ${n - 10} ${N.myC} ရှိတယ်။ 10 နဲ့ ${n - 10} ပေါင်းရင် ${n} ဖြစ်လို့ ${myCount(object, n)} ရှိတယ်။`,
            `มีแถวเต็ม 10 และอีก ${n - 10} ${N.thC} 10 กับ ${n - 10} รวมเป็น ${n} จึงมี${thCount(object, n)}`,
          )
        : T(
            `Touch each one as you count: ${list}. The last number you say is how many: ${n}.`,
            `ရေတွက်ရင်း တစ်ခုချင်းစီကို ထိပါ - ${list}။ နောက်ဆုံးပြောတဲ့ ဂဏန်းက အရေအတွက်ပါ - ${n}။`,
            `แตะทีละชิ้นขณะนับ: ${list} ตัวเลขสุดท้ายที่พูดคือจำนวนทั้งหมด: ${n}`,
          ),
    hint:
      n > 10
        ? T('Count the full row of 10 first, then count on.', '10 ပြည့်တဲ့ အတန်းကို အရင်ရေပြီး ဆက်ရေပါ။', 'นับแถวที่เต็ม 10 ก่อน แล้วนับต่อ')
        : T('Point to each one as you count.', 'ရေတွက်ရင်း တစ်ခုချင်းစီကို လက်ညှိုးထိုးပါ။', 'ชี้ทีละชิ้นขณะนับ'),
  });
}

export function numberWord(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(p.min, Math.min(p.max, 20));
  const word = NUMBER_WORDS[n]!;
  const my = numberToWords(n, 'my');
  const th = numberToWords(n, 'th');
  const distractors = nearbyNumbers(n, 0, [1, 2, 10]);
  if (n >= 13 && n <= 19) distractors.push(String((n % 10) * 10)); // e.g. fourteen vs forty
  return q({
    type: 'multiple_choice',
    prompt: T(`Which number is ${word}?`, `"${my}" ဆိုတာ ဘယ်ဂဏန်းလဲ။`, `"${th}" คือตัวเลขใด`),
    ...choices(rng, String(n), distractors),
    explanation:
      n >= 10
        ? T(
            `${capital(word)} is ${n}: 1 ten and ${n - 10} ones.`,
            `"${my}" ဆိုတာ ${n} ပါ - ဆယ် 1 ခုနဲ့ ခု ${n - 10} ခု။`,
            `"${th}" คือ ${n}: 1 สิบ กับ ${n - 10} หน่วย`,
          )
        : T(`${capital(word)} is written as ${n}.`, `"${my}" ကို ${n} လို့ ရေးတယ်။`, `"${th}" เขียนเป็น ${n}`),
    hint: T(
      'Say the numbers out loud as you look at each one.',
      'ဂဏန်းတစ်ခုချင်းကို ကြည့်ရင်း အသံထွက်ပြောပါ။',
      'พูดตัวเลขออกเสียงขณะดูแต่ละตัว',
    ),
  });
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
  const sum = `${before} ${down ? MINUS : '+'} ${p.step} = ${answer}`;
  return q({
    type: 'pattern',
    prompt: T('What number is missing from the pattern?', 'ပုံစံထဲမှာ ဘယ်ဂဏန်း ပျောက်နေလဲ။', 'ตัวเลขใดหายไปจากแบบรูป'),
    visual: { kind: 'sequence', items: shown },
    answer: { value: String(answer) },
    explanation: T(
      `The numbers go ${down ? 'down' : 'up'} by ${p.step} each time. ${sum}.`,
      `ဂဏန်းတွေက တစ်ခါစီ ${p.step} ${down ? 'လျော့' : 'တိုး'}သွားတယ်။ ${sum}။`,
      `ตัวเลข${down ? 'ลดลง' : 'เพิ่มขึ้น'}ทีละ ${p.step} ${sum}`,
    ),
    hint: T('How much does each number change by?', 'ဂဏန်းတစ်ခုစီ ဘယ်လောက် ပြောင်းသွားလဲ။', 'แต่ละตัวเปลี่ยนไปเท่าไร'),
  });
}

export function numberNeighbour(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const n = rng.int(Math.max(p.min, 1), p.max);
  const after = rng.next() < 0.5;
  const answer = after ? n + 1 : n - 1;
  return q({
    type: 'numeric',
    prompt: after
      ? T(`What number comes just after ${n}?`, `${n} ရဲ့ နောက်မှာ ချက်ချင်းလာတဲ့ ဂဏန်းက ဘာလဲ။`, `ตัวเลขใดอยู่ถัดจาก ${n}`)
      : T(`What number comes just before ${n}?`, `${n} ရဲ့ ရှေ့မှာ ချက်ချင်းရှိတဲ့ ဂဏန်းက ဘာလဲ။`, `ตัวเลขใดอยู่ก่อน ${n}`),
    visual: { kind: 'number_line', min: Math.max(0, n - 3), max: n + 3, step: 1, highlight: [n] },
    answer: { value: String(answer) },
    explanation: after
      ? T(
          `Counting on one from ${n} gives ${answer}. ${n} + 1 = ${answer}.`,
          `${n} ကနေ တစ်ခု ဆက်ရေရင် ${answer} ရတယ်။ ${n} + 1 = ${answer}။`,
          `นับต่อจาก ${n} ไปหนึ่ง ได้ ${answer} ${n} + 1 = ${answer}`,
        )
      : T(
          `Counting back one from ${n} gives ${answer}. ${n} ${MINUS} 1 = ${answer}.`,
          `${n} ကနေ တစ်ခု နောက်ပြန်ရေရင် ${answer} ရတယ်။ ${n} ${MINUS} 1 = ${answer}။`,
          `นับถอยหลังจาก ${n} ไปหนึ่ง ได้ ${answer} ${n} ${MINUS} 1 = ${answer}`,
        ),
    hint: T(
      `Find ${n} on the number line and take one step ${after ? 'right' : 'left'}.`,
      `ကိန်းမျဉ်းပေါ်မှာ ${n} ကိုရှာပြီး ${after ? 'ညာ' : 'ဘယ်'}ဘက်ကို တစ်လှမ်း လှမ်းပါ။`,
      `หา ${n} บนเส้นจำนวน แล้วก้าวไปทาง${after ? 'ขวา' : 'ซ้าย'}หนึ่งช่อง`,
    ),
  });
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
  const fact = `${a} ${symbol} ${b}`;
  let explanation: Tri;
  if (symbol === '=') {
    explanation = T(
      `${a} and ${b} are the same amount, so ${fact}.`,
      `${a} နဲ့ ${b} က အရေအတွက် တူတယ်၊ ဒါကြောင့် ${fact}။`,
      `${a} กับ ${b} มีจำนวนเท่ากัน ดังนั้น ${fact}`,
    );
  } else {
    const [big, small] = a > b ? [a, b] : [b, a];
    const [bt, st] = [Math.floor(big / 10), Math.floor(small / 10)];
    const reason =
      big >= 10 && bt !== st
        ? T(
            `Compare the tens first: ${bt} tens is more than ${st} tens.`,
            `ဆယ်လီကို အရင်နှိုင်းယှဉ်ပါ - ဆယ် ${bt} ခုက ဆယ် ${st} ခုထက် များတယ်။`,
            `เปรียบเทียบหลักสิบก่อน: ${bt} สิบ มากกว่า ${st} สิบ`,
          )
        : big >= 10
          ? T(
              `The tens are the same, so compare the ones: ${big % 10} is more than ${small % 10}.`,
              `ဆယ်လီ တူတယ်၊ ဒါကြောင့် ခုလီကို နှိုင်းယှဉ်ပါ - ${big % 10} က ${small % 10} ထက် များတယ်။`,
              `หลักสิบเท่ากัน จึงเปรียบเทียบหลักหน่วย: ${big % 10} มากกว่า ${small % 10}`,
            )
          : T(`${big} is more than ${small}.`, `${big} က ${small} ထက် များတယ်။`, `${big} มากกว่า ${small}`);
    explanation = T(
      `${reason.en} So ${fact}. The open side of the sign faces the bigger number.`,
      `${reason.my} ဒါကြောင့် ${fact}။ သင်္ကေတရဲ့ ပွင့်နေတဲ့ဘက်က ပိုကြီးတဲ့ ဂဏန်းဘက်ကို လှည့်နေတယ်။`,
      `${reason.th} ดังนั้น ${fact} ด้านที่เปิดของเครื่องหมายหันไปทางจำนวนที่มากกว่า`,
    );
  }
  return q({
    type: 'compare',
    prompt: object
      ? T(
          'Which sign makes this true? Compare the groups.',
          'ဘယ်သင်္ကေတက ဒါကို မှန်စေလဲ။ အုပ်စုတွေကို နှိုင်းယှဉ်ပါ။',
          'เครื่องหมายใดทำให้ถูกต้อง เปรียบเทียบกลุ่มดู',
        )
      : SIGN_PROMPT,
    visual: { kind: 'compare', left: String(a), right: String(b), ...(object ? { object } : {}) },
    answer: { value: symbol },
    explanation,
    hint: T(
      'Which number is bigger? The open side of < or > faces the bigger number.',
      'ဘယ်ဂဏန်းက ပိုကြီးလဲ။ < ဒါမှမဟုတ် > ရဲ့ ပွင့်နေတဲ့ဘက်က ပိုကြီးတဲ့ ဂဏန်းဘက်ကို လှည့်တယ်။',
      'จำนวนใดมากกว่า ด้านที่เปิดของ < หรือ > หันไปทางจำนวนที่มากกว่า',
    ),
  });
}

export function orderNumbers(rng: Rng, p: { min: number; max: number; ask: 'biggest' | 'smallest' }): GeneratedQuestion {
  const nums = new Set<number>();
  while (nums.size < 4) nums.add(rng.int(p.min, p.max));
  const list = [...nums];
  const biggest = p.ask === 'biggest';
  const answer = biggest ? Math.max(...list) : Math.min(...list);
  const sorted = [...list].sort((x, y) => x - y).join(', ');
  const my = biggest ? 'အကြီးဆုံး' : 'အငယ်ဆုံး';
  const th = biggest ? 'มากที่สุด' : 'น้อยที่สุด';
  return q({
    type: 'multiple_choice',
    prompt: T(`Which number is the ${p.ask}?`, `ဘယ်ဂဏန်းက ${my}လဲ။`, `จำนวนใด${th}`),
    ...choices(rng, String(answer), list.map(String)),
    explanation: T(
      `In order from smallest to biggest: ${sorted}. The ${p.ask} is ${answer}.`,
      `အငယ်ဆုံးမှ အကြီးဆုံးသို့ စီရင် - ${sorted}။ ${my}က ${answer} ပါ။`,
      `เรียงจากน้อยไปมาก: ${sorted} จำนวนที่${th}คือ ${answer}`,
    ),
    hint: T('Put the numbers in order first.', 'ဂဏန်းတွေကို အရင် အစဉ်လိုက်စီပါ။', 'เรียงลำดับจำนวนก่อน'),
  });
}

export function addObjects(rng: Rng, p: { maxSum: number }): GeneratedQuestion {
  const a = rng.int(1, p.maxSum - 1);
  const b = rng.int(1, p.maxSum - a);
  const sum = a + b;
  const object = rng.pick(OBJECT_KEYS);
  const N = NOUN[object];
  const list = countList(a + 1, sum);
  return q({
    type: 'numeric',
    prompt: T(
      `${a} ${N.en} and ${b} more. How many altogether?`,
      `${myCount(object, a)} နဲ့ နောက်ထပ် ${b} ${N.myC}။ စုစုပေါင်း ဘယ်နှ${N.myC}လဲ။`,
      `${thCount(object, a)} และอีก ${b} ${N.thC} รวมทั้งหมดกี่${N.thC}`,
    ),
    visual: { kind: 'objects', object, groups: [a, b] },
    answer: { value: String(sum) },
    explanation: T(
      `Start with ${a} and count on ${b}: ${list}. So ${a} + ${b} = ${sum}.`,
      `${a} ကနေ စပြီး ${b} ခု ဆက်ရေပါ - ${list}။ ဒါကြောင့် ${a} + ${b} = ${sum}။`,
      `เริ่มที่ ${a} แล้วนับต่ออีก ${b}: ${list} ดังนั้น ${a} + ${b} = ${sum}`,
    ),
    hint: T(`Start at ${a} and count on ${b} more.`, `${a} ကနေ စပြီး နောက်ထပ် ${b} ခု ဆက်ရေပါ။`, `เริ่มที่ ${a} แล้วนับต่ออีก ${b}`),
  });
}

export function addNumberLine(rng: Rng, p: { minSum: number; maxSum: number }): GeneratedQuestion {
  const sum = rng.int(p.minSum, p.maxSum);
  const b = rng.int(2, Math.min(9, sum - 1));
  const a = sum - b;
  return q({
    type: 'numeric',
    prompt: wh(`${a} + ${b}`, `${a} + ${b}`, `${a} + ${b}`),
    visual: { kind: 'number_line', min: Math.max(0, a - 2), max: sum + 2, step: 1, highlight: [a], jumps: [{ from: a, to: sum }] },
    answer: { value: String(sum) },
    explanation: T(
      `Start at ${a} on the number line and jump ${b} to the right. You land on ${sum}, so ${a} + ${b} = ${sum}.`,
      `ကိန်းမျဉ်းပေါ်က ${a} မှာ စပြီး ညာဘက်ကို ${b} ခုန်ပါ။ ${sum} မှာ ရောက်လို့ ${a} + ${b} = ${sum}။`,
      `เริ่มที่ ${a} บนเส้นจำนวน แล้วกระโดดไปทางขวา ${b} ช่อง จะถึง ${sum} ดังนั้น ${a} + ${b} = ${sum}`,
    ),
    hint: T(
      `Put your finger on ${a} and jump forward ${b}.`,
      `${a} ပေါ်မှာ လက်ချောင်းတင်ပြီး ရှေ့ကို ${b} ခုန်ပါ။`,
      `วางนิ้วที่ ${a} แล้วกระโดดไปข้างหน้า ${b} ช่อง`,
    ),
  });
}

export function missingAddend(rng: Rng, p: { maxSum: number }): GeneratedQuestion {
  const sum = rng.int(4, p.maxSum);
  const a = rng.int(1, sum - 1);
  const missing = sum - a;
  const blankFirst = rng.next() < 0.3;
  const parts = blankFirst ? [null, '+', String(a), '=', String(sum)] : [String(a), '+', null, '=', String(sum)];
  const eq = `${blankFirst ? `${missing} + ${a}` : `${a} + ${missing}`} = ${sum}`;
  const check = `${sum} ${MINUS} ${a} = ${missing}`;
  return q({
    type: 'missing_number',
    prompt: BOX_PROMPT,
    visual: { kind: 'equation', parts: parts as Extract<VisualData, { kind: 'equation' }>['parts'] },
    answer: { value: String(missing) },
    explanation: T(
      `Count on from ${a} to ${sum}: that is ${missing} steps. So ${eq}. You can check with ${check}.`,
      `${a} ကနေ ${sum} အထိ ဆက်ရေပါ - ${missing} လှမ်း ရှိတယ်။ ဒါကြောင့် ${eq}။ ${check} နဲ့ စစ်ကြည့်နိုင်တယ်။`,
      `นับต่อจาก ${a} ถึง ${sum}: ได้ ${missing} ก้าว ดังนั้น ${eq} ตรวจได้ด้วย ${check}`,
    ),
    hint: T(
      `How many more do you need to get from ${a} to ${sum}?`,
      `${a} ကနေ ${sum} ရောက်ဖို့ နောက်ထပ် ဘယ်နှခု လိုလဲ။`,
      `จาก ${a} ไป ${sum} ต้องเพิ่มอีกเท่าไร`,
    ),
  });
}

export function subtractObjects(rng: Rng, p: { max: number }): GeneratedQuestion {
  const a = rng.int(3, p.max);
  const b = rng.int(1, a - 1);
  const left = a - b;
  const object = rng.pick(['cookie', 'apple', 'balloon', 'flower'] as const);
  const N = NOUN[object];
  const verb = {
    cookie: T('are eaten', 'ကို စားလိုက်တယ်', 'ถูกกินไป'),
    apple: T('are eaten', 'ကို စားလိုက်တယ်', 'ถูกกินไป'),
    balloon: T('float away', 'လွင့်ထွက်သွားတယ်', 'ลอยหายไป'),
    flower: T('are picked', 'ကို ခူးလိုက်တယ်', 'ถูกเด็ดไป'),
  }[object];
  const fact = `${a} ${MINUS} ${b} = ${left}`;
  return q({
    type: 'numeric',
    prompt: T(
      `There are ${a} ${N.en}. ${b} ${verb.en}. How many are left?`,
      `${myCount(object, a)} ရှိတယ်။ ${b} ${N.myC} ${verb.my}။ ဘယ်နှ${N.myC} ကျန်လဲ။`,
      `มี${thCount(object, a)} ${verb.th} ${b} ${N.thC} เหลือกี่${N.thC}`,
    ),
    visual: { kind: 'objects', object, groups: [a], crossedOut: b },
    answer: { value: String(left) },
    explanation: T(
      `Start with ${a} and take away ${b}. Count the ones that are not crossed out: ${left}. So ${fact}.`,
      `${a} ကနေ စပြီး ${b} ကို ယူလိုက်ပါ။ မခြစ်ထားတာတွေကို ရေပါ - ${left}။ ဒါကြောင့် ${fact}။`,
      `เริ่มที่ ${a} แล้วเอาออก ${b} นับอันที่ไม่ได้ขีดฆ่า: ${left} ดังนั้น ${fact}`,
    ),
    hint: T('Count the ones that are not crossed out.', 'မခြစ်ထားတာတွေကို ရေပါ။', 'นับอันที่ไม่ได้ขีดฆ่า'),
  });
}

export function subtractNumberLine(rng: Rng, p: { min: number; max: number }): GeneratedQuestion {
  const a = rng.int(Math.max(p.min, 4), p.max);
  const b = rng.int(2, Math.min(9, a - 1));
  const r = a - b;
  const sum = `${a} ${MINUS} ${b}`;
  return q({
    type: 'numeric',
    prompt: wh(sum, sum, sum),
    visual: { kind: 'number_line', min: Math.max(0, r - 2), max: a + 2, step: 1, highlight: [a], jumps: [{ from: a, to: r }] },
    answer: { value: String(r) },
    explanation: T(
      `Start at ${a} and jump ${b} to the left. You land on ${r}, so ${sum} = ${r}.`,
      `${a} မှာ စပြီး ဘယ်ဘက်ကို ${b} ခုန်ပါ။ ${r} မှာ ရောက်လို့ ${sum} = ${r}။`,
      `เริ่มที่ ${a} แล้วกระโดดไปทางซ้าย ${b} ช่อง จะถึง ${r} ดังนั้น ${sum} = ${r}`,
    ),
    hint: T(`Start at ${a} and count back ${b}.`, `${a} ကနေ စပြီး ${b} ခု နောက်ပြန်ရေပါ။`, `เริ่มที่ ${a} แล้วนับถอยหลัง ${b}`),
  });
}

const BIGGER_OR_SMALLER = T('Does the number get bigger or smaller?', 'ဂဏန်းက ကြီးလာမလား၊ ငယ်သွားမလား။', 'จำนวนมากขึ้นหรือน้อยลง');

export function addSubStory(rng: Rng, p: { max: number }): GeneratedQuestion {
  const name = rng.pick(NAMES);
  if (rng.next() < 0.5) {
    const a = rng.int(2, p.max - 2);
    const b = rng.int(1, p.max - a);
    const key = rng.pick(['stickers', 'shells', 'marbles', 'crayons'] as const);
    const thing = {
      stickers: { my: 'စတစ်ကာ', myC: 'ခု', th: 'สติกเกอร์', thC: 'แผ่น' },
      shells: { my: 'ခရုခွံ', myC: 'ခု', th: 'เปลือกหอย', thC: 'อัน' },
      marbles: { my: 'ဂေါ်လီလုံး', myC: 'လုံး', th: 'ลูกแก้ว', thC: 'ลูก' },
      crayons: { my: 'ရောင်စုံခဲ', myC: 'ချောင်း', th: 'สีเทียน', thC: 'แท่ง' },
    }[key];
    return q({
      type: 'numeric',
      prompt: T(
        `${name.en} has ${a} ${key}. A friend gives ${name.en} ${b} more. How many ${key} does ${name.en} have now?`,
        `${name.my} မှာ ${thing.my} ${a} ${thing.myC} ရှိတယ်။ သူငယ်ချင်းက ${name.my} ကို နောက်ထပ် ${b} ${thing.myC} ပေးတယ်။ အခု ${name.my} မှာ ${thing.my} ဘယ်နှ${thing.myC} ရှိလဲ။`,
        `${name.th}มี${thing.th} ${a} ${thing.thC} เพื่อนให้${name.th}อีก ${b} ${thing.thC} ตอนนี้${name.th}มี${thing.th}กี่${thing.thC}`,
      ),
      answer: { value: String(a + b) },
      explanation: T(
        `"Gives more" means add. ${a} + ${b} = ${a + b}, so ${name.en} has ${a + b} ${key}.`,
        `"ပေးတယ်" ဆိုတာ ပေါင်းရမယ်။ ${a} + ${b} = ${a + b}၊ ဒါကြောင့် ${name.my} မှာ ${thing.my} ${a + b} ${thing.myC} ရှိတယ်။`,
        `"ให้เพิ่ม" แปลว่าบวก ${a} + ${b} = ${a + b} ดังนั้น${name.th}มี${thing.th} ${a + b} ${thing.thC}`,
      ),
      hint: BIGGER_OR_SMALLER,
    });
  }
  const a = rng.int(5, p.max);
  const b = rng.int(1, a - 1);
  const key = rng.pick(['grapes', 'strawberries', 'crackers'] as const);
  const thing = {
    grapes: { my: 'စပျစ်သီး', myC: 'လုံး', th: 'องุ่น', thC: 'ลูก' },
    strawberries: { my: 'စတော်ဘယ်ရီသီး', myC: 'လုံး', th: 'สตรอว์เบอร์รี', thC: 'ลูก' },
    crackers: { my: 'ဘီစကွတ်', myC: 'ချပ်', th: 'แครกเกอร์', thC: 'ชิ้น' },
  }[key];
  const fact = `${a} ${MINUS} ${b} = ${a - b}`;
  return q({
    type: 'numeric',
    prompt: T(
      `${name.en} has ${a} ${key} and eats ${b}. How many ${key} are left?`,
      `${name.my} မှာ ${thing.my} ${a} ${thing.myC} ရှိပြီး ${b} ${thing.myC} စားလိုက်တယ်။ ${thing.my} ဘယ်နှ${thing.myC} ကျန်လဲ။`,
      `${name.th}มี${thing.th} ${a} ${thing.thC} กินไป ${b} ${thing.thC} เหลือ${thing.th}กี่${thing.thC}`,
    ),
    answer: { value: String(a - b) },
    explanation: T(
      `"Eats" means some are taken away, so subtract. ${fact}. There are ${a - b} left.`,
      `"စားတယ်" ဆိုတာ တချို့ ယူသွားတာမို့ နုတ်ရမယ်။ ${fact}။ ${a - b} ${thing.myC} ကျန်တယ်။`,
      `"กิน" แปลว่ามีบางส่วนหายไป จึงลบ ${fact} เหลือ ${a - b} ${thing.thC}`,
    ),
    hint: BIGGER_OR_SMALLER,
  });
}

const SHAPE_SIDES: Partial<Record<ShapeKey, number>> = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 };

export function shapeSides(rng: Rng): GeneratedQuestion {
  const shape = rng.pick(Object.keys(SHAPE_SIDES) as ShapeKey[]);
  const sides = SHAPE_SIDES[shape]!;
  const name = SHAPE_NAME[shape];
  const list = countList(1, sides);
  return q({
    type: 'numeric',
    prompt: T('How many straight sides does this shape have?', 'ဒီပုံမှာ အနားဖြောင့် ဘယ်နှခု ရှိလဲ။', 'รูปนี้มีด้านตรงกี่ด้าน'),
    visual: { kind: 'shape', shape },
    answer: { value: String(sides) },
    explanation: T(
      `Count each straight edge once, going around the shape: ${list}. A ${name.en} has ${sides} sides.`,
      `ပုံကို ပတ်ပြီး အနားဖြောင့် တစ်ခုစီကို တစ်ကြိမ်စီ ရေပါ - ${list}။ ${name.my} မှာ အနား ${sides} ခု ရှိတယ်။`,
      `นับด้านตรงทีละด้านรอบรูป: ${list} ${name.th}มี ${sides} ด้าน`,
    ),
    hint: T(
      'Put a finger on one side and go around the shape.',
      'အနားတစ်ခုပေါ်မှာ လက်ချောင်းတင်ပြီး ပုံကို ပတ်သွားပါ။',
      'วางนิ้วบนด้านหนึ่ง แล้วไล่ไปรอบรูป',
    ),
  });
}

export function shapeName(rng: Rng): GeneratedQuestion {
  const shape = rng.pick(['circle', 'square', 'triangle', 'rectangle', 'hexagon', 'oval'] as const);
  const facts: Record<string, Tri> = {
    circle: T('A circle is perfectly round and has no corners.', 'စက်ဝိုင်းက လုံးဝ ဝိုင်းပြီး ထောင့် မရှိဘူး။', 'วงกลมกลมทั้งรูปและไม่มีมุม'),
    square: T('A square has 4 equal sides and 4 corners.', 'စတုရန်းမှာ အနားညီ 4 ခုနဲ့ ထောင့် 4 ခု ရှိတယ်။', 'สี่เหลี่ยมจัตุรัสมีด้านยาวเท่ากัน 4 ด้าน และมี 4 มุม'),
    triangle: T('A triangle has 3 sides and 3 corners.', 'တြိဂံမှာ အနား 3 ခုနဲ့ ထောင့် 3 ခု ရှိတယ်။', 'สามเหลี่ยมมี 3 ด้าน และ 3 มุม'),
    rectangle: T(
      'A rectangle has 4 sides and 4 square corners. Its opposite sides are equal, two long and two short.',
      'ထောင့်မှန်စတုဂံမှာ အနား 4 ခုနဲ့ ထောင့်မှန် 4 ခု ရှိတယ်။ မျက်နှာချင်းဆိုင် အနားတွေ ညီတယ် - အရှည် နှစ်ခုနဲ့ အတို နှစ်ခု။',
      'สี่เหลี่ยมผืนผ้ามี 4 ด้าน และมีมุมฉาก 4 มุม ด้านตรงข้ามยาวเท่ากัน คือด้านยาวสองด้านและด้านสั้นสองด้าน',
    ),
    hexagon: T('A hexagon has 6 sides and 6 corners.', 'ဆဋ္ဌဂံမှာ အနား 6 ခုနဲ့ ထောင့် 6 ခု ရှိတယ်။', 'หกเหลี่ยมมี 6 ด้าน และ 6 มุม'),
    oval: T('An oval is round like a stretched circle, with no corners.', 'ဘဲဥပုံက ဆွဲဆန့်ထားတဲ့ စက်ဝိုင်းလို ဝိုင်းပြီး ထောင့် မရှိဘူး။', 'วงรีกลมเหมือนวงกลมที่ถูกยืดออก และไม่มีมุม'),
  };
  const confusable: Record<string, string[]> = {
    circle: ['oval', 'square', 'triangle'],
    square: ['rectangle', 'triangle', 'circle'],
    triangle: ['square', 'pentagon', 'circle'],
    rectangle: ['square', 'hexagon', 'triangle'],
    hexagon: ['pentagon', 'square', 'circle'],
    oval: ['circle', 'rectangle', 'triangle'],
  };
  const { options, answer } = choices(rng, shape, confusable[shape]!);
  return q({
    type: 'multiple_choice',
    prompt: T('What is the name of this shape?', 'ဒီပုံရဲ့ နာမည်က ဘာလဲ။', 'รูปนี้ชื่ออะไร'),
    visual: { kind: 'shape', shape },
    options,
    answer,
    optionText: shapeOptionText(options),
    explanation: facts[shape]!,
    hint: T('Count the sides and corners.', 'အနားတွေနဲ့ ထောင့်တွေကို ရေပါ။', 'นับด้านและมุม'),
  });
}

export function shapePattern(rng: Rng, p: { unitLength: 2 | 3 }): GeneratedQuestion {
  const pool: ShapeKey[] = ['circle', 'square', 'triangle', 'star', 'hexagon'];
  const unit = rng.shuffle(pool).slice(0, p.unitLength);
  const length = p.unitLength === 2 ? 6 : 7;
  const full = Array.from({ length }, (_, i) => unit[i % unit.length]!);
  const answer = full[length - 1]!;
  const prev = full[length - 2]!;
  const items: (ShapeKey | null)[] = [...full.slice(0, -1), null];
  const { options, answer: answerData } = choices(rng, answer, pool.filter((s) => s !== answer));
  const names = (l: Locale, sep: string) => unit.map((s) => SHAPE_NAME[s][l]).join(sep);
  return q({
    type: 'multiple_choice',
    prompt: T('Which shape comes next?', 'နောက်ထပ် ဘယ်ပုံ လာမလဲ။', 'รูปใดมาต่อไป'),
    visual: { kind: 'shape_sequence', items },
    options: options.map((o) => ({ ...o, visual: { kind: 'shape' as const, shape: o.label as ShapeKey } })),
    answer: answerData,
    optionText: shapeOptionText(options),
    explanation: T(
      `The pattern repeats ${names('en', ', ')}. After ${prev} comes ${answer}.`,
      `ပုံစံက ${names('my', '၊ ')} ကို ထပ်ခါထပ်ခါ လုပ်တယ်။ ${SHAPE_NAME[prev].my} ပြီးရင် ${SHAPE_NAME[answer].my} လာတယ်။`,
      `แบบรูปซ้ำเป็น ${names('th', ', ')} หลัง${SHAPE_NAME[prev].th}คือ${SHAPE_NAME[answer].th}`,
    ),
    hint: T('Find the part that repeats. Say it out loud.', 'ထပ်နေတဲ့ အပိုင်းကို ရှာပါ။ အသံထွက်ပြောကြည့်ပါ။', 'หาส่วนที่ซ้ำ แล้วพูดออกเสียง'),
  });
}

export function measureRuler(rng: Rng): GeneratedQuestion {
  const length = rng.int(2, 14);
  const object = rng.pick(['pencil', 'crayon', 'ribbon', 'worm'] as const);
  const name = {
    pencil: T('pencil', 'ခဲတံ', 'ดินสอ'),
    crayon: T('crayon', 'ရောင်စုံခဲ', 'สีเทียน'),
    ribbon: T('ribbon', 'ဖဲကြိုး', 'ริบบิ้น'),
    worm: T('worm', 'တီကောင်', 'หนอน'),
  }[object];
  return q({
    type: 'numeric',
    prompt: T(`How long is the ${name.en}, in centimetres?`, `${name.my} က စင်တီမီတာ ဘယ်လောက် ရှည်လဲ။`, `${name.th}ยาวกี่เซนติเมตร`),
    visual: { kind: 'ruler', length, object },
    answer: { value: String(length) },
    explanation: T(
      `The ${name.en} starts at 0 and ends at ${length}, so it is ${length} cm long.`,
      `${name.my} က 0 မှာ စပြီး ${length} မှာ ဆုံးလို့ ${length} စင်တီမီတာ ရှည်တယ်။`,
      `${name.th}เริ่มที่ 0 และสิ้นสุดที่ ${length} จึงยาว ${length} ซม.`,
    ),
    hint: T(
      'Look at where the end of it lines up on the ruler.',
      'အဆုံးက ပေတံပေါ်မှာ ဘယ်နေရာနဲ့ ညီနေလဲ ကြည့်ပါ။',
      'ดูว่าปลายของมันตรงกับตัวเลขใดบนไม้บรรทัด',
    ),
  });
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
  const sum = `${h * 100} + ${t * 10} + ${o} = ${n}`;
  return q({
    type: 'visual_quantity',
    prompt: T('What number do the blocks show?', 'တုံးတွေက ဘယ်ဂဏန်းကို ပြနေလဲ။', 'บล็อกแสดงจำนวนใด'),
    visual: { kind: 'base_ten', hundreds: h, tens: t, ones: o },
    options: rng
      .shuffle([n, ...rng.shuffle([...new Set(pool)]).slice(0, 3)])
      .map((x) => ({ id: String(x), label: String(x) })),
    answer: { value: String(n) },
    explanation: T(
      `${h} hundreds = ${h * 100}, ${t} tens = ${t * 10} and ${o} ones = ${o}. ${sum}.`,
      `ရာ ${h} ခု = ${h * 100}၊ ဆယ် ${t} ခု = ${t * 10}၊ ခု ${o} ခု = ${o}။ ${sum}။`,
      `${h} ร้อย = ${h * 100} ${t} สิบ = ${t * 10} และ ${o} หน่วย = ${o} ${sum}`,
    ),
    hint: T(
      'Count the hundreds, then the tens, then the ones.',
      'ရာတွေကို အရင်ရေ၊ ပြီးရင် ဆယ်တွေ၊ ပြီးရင် ခုတွေကို ရေပါ။',
      'นับหลักร้อยก่อน แล้วหลักสิบ แล้วหลักหน่วย',
    ),
  });
}

export function digitValue(rng: Rng): GeneratedQuestion {
  // Distinct non-zero digits so "the digit d" is unambiguous.
  const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const n = digits.reduce((acc, d) => acc * 10 + d, 0);
  const pos = rng.int(0, 3); // 0 = thousands
  const d = digits[pos]!;
  const place = [T('thousands', 'ထောင်', 'พัน'), T('hundreds', 'ရာ', 'ร้อย'), T('tens', 'ဆယ်', 'สิบ'), T('ones', 'ခု', 'หน่วย')][pos]!;
  const value = d * 10 ** (3 - pos);
  const group = (x: number) => x.toLocaleString('en-US');
  const all = [d * 1000, d * 100, d * 10, d].map(group);
  return q({
    type: 'multiple_choice',
    prompt: T(
      `What is the value of the digit ${d} in ${group(n)}?`,
      `${group(n)} ထဲက ဂဏန်း ${d} ရဲ့ တန်ဖိုးက ဘာလဲ။`,
      `เลข ${d} ใน ${group(n)} มีค่าเท่าไร`,
    ),
    ...choices(rng, group(value), all),
    explanation: T(
      `The ${d} is in the ${place.en} place, so it is worth ${d} ${place.en}: ${group(value)}.`,
      `${d} က ${place.my}လီ နေရာမှာ ရှိလို့ ${place.my} ${d} ခု တန်ဖိုး ရှိတယ် - ${group(value)}။`,
      `เลข ${d} อยู่ในหลัก${place.th} จึงมีค่า ${d} ${place.th}: ${group(value)}`,
    ),
    hint: T(
      'Name each place from the right: ones, tens, hundreds, thousands.',
      'ညာဘက်ကနေ နေရာတစ်ခုစီကို အမည်ပေးပါ - ခု၊ ဆယ်၊ ရာ၊ ထောင်။',
      'เรียกชื่อหลักจากขวา: หน่วย สิบ ร้อย พัน',
    ),
  });
}

export function roundNumber(rng: Rng, p: { to: 10 | 100 }): GeneratedQuestion {
  let n = p.to === 10 ? rng.int(11, 99) : rng.int(101, 999);
  if (n % p.to === 0) n += 3;
  const lower = Math.floor(n / p.to) * p.to;
  const upper = lower + p.to;
  const deciding = p.to === 10 ? n % 10 : Math.floor((n % 100) / 10);
  const up = deciding >= 5;
  const answer = up ? upper : lower;
  const digit = p.to === 10 ? T('ones', 'ခု', 'หน่วย') : T('tens', 'ဆယ်', 'สิบ');
  return q({
    type: 'numeric',
    prompt: T(
      `Round ${n} to the nearest ${p.to}.`,
      `${n} ကို အနီးစပ်ဆုံး ${p.to} ပြည့်ကိန်းသို့ ပြောင်းပါ။`,
      `ปัด ${n} เป็นจำนวนเต็ม${p.to === 10 ? 'สิบ' : 'ร้อย'}ที่ใกล้ที่สุด`,
    ),
    visual: { kind: 'number_line', min: lower, max: upper, step: p.to / 10, highlight: [n] },
    answer: { value: String(answer) },
    explanation: T(
      `${n} is between ${lower} and ${upper}. The ${digit.en} digit is ${deciding}, which is ${up ? '5 or more, so round up' : 'less than 5, so round down'} to ${answer}.`,
      `${n} က ${lower} နဲ့ ${upper} ကြားမှာ ရှိတယ်။ ${digit.my}လီ ဂဏန်းက ${deciding} ဖြစ်ပြီး ${up ? '5 နဲ့ အထက်ဖြစ်လို့ အပေါ်ကို' : '5 ထက်ငယ်လို့ အောက်ကို'} ပြောင်းရမယ် - ${answer}။`,
      `${n} อยู่ระหว่าง ${lower} กับ ${upper} เลขในหลัก${digit.th}คือ ${deciding} ซึ่ง${up ? 'มากกว่าหรือเท่ากับ 5 จึงปัดขึ้น' : 'น้อยกว่า 5 จึงปัดลง'}เป็น ${answer}`,
    ),
    hint: T(
      `Look at the ${digit.en} digit. Is it 5 or more?`,
      `${digit.my}လီ ဂဏန်းကို ကြည့်ပါ။ 5 နဲ့ အထက်လား။`,
      `ดูเลขในหลัก${digit.th} มากกว่าหรือเท่ากับ 5 ไหม`,
    ),
  });
}

export function arrayMultiply(rng: Rng, p: { maxFactor: number }): GeneratedQuestion {
  const rows = rng.int(2, Math.min(p.maxFactor, 6));
  const cols = rng.int(2, Math.min(p.maxFactor, 8));
  const object = rng.pick(['star', 'apple', 'flower', 'block'] as const);
  const N = NOUN[object];
  const product = rows * cols;
  const counting = Array.from({ length: rows }, (_, i) => cols * (i + 1)).join(', ');
  const fact = `${rows} × ${cols} = ${product}`;
  return q({
    type: 'numeric',
    prompt: T(
      `There are ${rows} rows with ${cols} ${N.en} in each row. How many ${N.en} are there?`,
      `အတန်း ${rows} တန်း ရှိပြီး တစ်တန်းမှာ ${myCount(object, cols)} စီ ရှိတယ်။ ${N.my} ဘယ်နှ${N.myC} ရှိလဲ။`,
      `มี ${rows} แถว แถวละ ${thCount(object, cols)} มี${N.th}ทั้งหมดกี่${N.thC}`,
    ),
    visual: { kind: 'array', rows, cols, object },
    answer: { value: String(product) },
    explanation: T(
      `${rows} rows of ${cols} is ${rows} × ${cols}. Count in ${cols}s: ${counting}. So ${fact}.`,
      `${cols} စီပါတဲ့ အတန်း ${rows} တန်းက ${rows} × ${cols} ပါ။ ${cols} စီ ရေပါ - ${counting}။ ဒါကြောင့် ${fact}။`,
      `${rows} แถว แถวละ ${cols} คือ ${rows} × ${cols} นับทีละ ${cols}: ${counting} ดังนั้น ${fact}`,
    ),
    hint: T(`Count in ${cols}s, once for each row.`, `အတန်းတစ်တန်းအတွက် တစ်ခါစီ ${cols} စီ ရေပါ။`, `นับทีละ ${cols} แถวละหนึ่งครั้ง`),
  });
}

export function timesTable(rng: Rng, p: { tables: number[]; missing?: boolean }): GeneratedQuestion {
  const t = rng.pick(p.tables);
  const k = rng.int(2, 12);
  const product = t * k;
  if (p.missing) {
    const fact = `${t} × ${k} = ${product}`;
    const check = `${product} ÷ ${t} = ${k}`;
    return q({
      type: 'missing_number',
      prompt: BOX_PROMPT,
      visual: { kind: 'equation', parts: [String(t), '×', null, '=', String(product)] },
      answer: { value: String(k) },
      explanation: T(
        `Count in ${t}s until you reach ${product}: that takes ${k} steps. So ${fact}. Check: ${check}.`,
        `${product} ရောက်တဲ့အထိ ${t} စီ ရေပါ - ${k} လှမ်း ကြာတယ်။ ဒါကြောင့် ${fact}။ စစ်ကြည့်ပါ - ${check}။`,
        `นับทีละ ${t} จนถึง ${product}: ใช้ ${k} ครั้ง ดังนั้น ${fact} ตรวจ: ${check}`,
      ),
      hint: T(`How many ${t}s make ${product}?`, `${t} ဘယ်နှခု ပေါင်းရင် ${product} ဖြစ်လဲ။`, `${t} กี่ตัวรวมกันได้ ${product}`),
    });
  }
  const fact = `${k} × ${t} = ${product}`;
  const method = multiplyMethod(k, t);
  return q({
    type: 'numeric',
    prompt: wh(`${k} × ${t}`, `${k} × ${t}`, `${k} × ${t}`),
    answer: { value: String(product) },
    explanation: T(
      `${k} × ${t} means ${k} groups of ${t}. ${method.en} So ${fact}.`,
      `${k} × ${t} ဆိုတာ ${t} စီပါတဲ့ အုပ်စု ${k} စုပါ။ ${method.my} ဒါကြောင့် ${fact}။`,
      `${k} × ${t} หมายถึง ${k} กลุ่ม กลุ่มละ ${t} ${method.th} ดังนั้น ${fact}`,
    ),
    hint: T(`Count in ${t}s, ${k} times.`, `${t} စီ ${k} ကြိမ် ရေပါ။`, `นับทีละ ${t} จำนวน ${k} ครั้ง`),
  });
}

function multiplyMethod(k: number, t: number): Tri {
  if (k <= 5) {
    const list = Array.from({ length: k }, (_, i) => t * (i + 1)).join(', ');
    return T(`Count in ${t}s: ${list}.`, `${t} စီ ရေပါ - ${list}။`, `นับทีละ ${t}: ${list}`);
  }
  // Split into 5 groups and the rest, which is easier to do in your head.
  const [a, b] = [5 * t, (k - 5) * t];
  const parts = `5 × ${t} = ${a}`;
  const rest = `${k - 5} × ${t} = ${b}`;
  const total = `${a} + ${b} = ${k * t}`;
  return T(
    `Split it up: ${parts} and ${rest}. ${total}.`,
    `ခွဲလိုက်ပါ - ${parts} နဲ့ ${rest}။ ${total}။`,
    `แยกคิด: ${parts} และ ${rest} ${total}`,
  );
}

export function multiplyStory(rng: Rng, p: { maxFactor: number }): GeneratedQuestion {
  const a = rng.int(2, p.maxFactor);
  const b = rng.int(2, p.maxFactor);
  const name = rng.pick(NAMES);
  const t = rng.pick([
    { box: 'boxes', item: 'pencils', my: ['သေတ္တာ', 'လုံး', 'ခဲတံ', 'ချောင်း'], th: ['กล่อง', 'กล่อง', 'ดินสอ', 'แท่ง'] },
    { box: 'bags', item: 'oranges', my: ['အိတ်', 'လုံး', 'လိမ္မော်သီး', 'လုံး'], th: ['ถุง', 'ถุง', 'ส้ม', 'ผล'] },
    { box: 'tables', item: 'chairs', my: ['စားပွဲ', 'လုံး', 'ကုလားထိုင်', 'လုံး'], th: ['โต๊ะ', 'ตัว', 'เก้าอี้', 'ตัว'] },
    { box: 'packs', item: 'stickers', my: ['ထုပ်', 'ထုပ်', 'စတစ်ကာ', 'ခု'], th: ['แพ็ก', 'แพ็ก', 'สติกเกอร์', 'แผ่น'] },
  ] as const);
  const [myBox, myBoxC, myItem, myItemC] = t.my;
  const [thBox, thBoxC, thItem, thItemC] = t.th;
  const fact = `${a} × ${b} = ${a * b}`;
  return q({
    type: 'numeric',
    prompt: T(
      `${name.en} has ${a} ${t.box} with ${b} ${t.item} in each. How many ${t.item} are there altogether?`,
      `${name.my} မှာ ${myBox} ${a} ${myBoxC} ရှိပြီး တစ်${myBoxC}စီမှာ ${myItem} ${b} ${myItemC} ပါတယ်။ ${myItem} စုစုပေါင်း ဘယ်နှ${myItemC} ရှိလဲ။`,
      `${name.th}มี${thBox} ${a} ${thBoxC} แต่ละ${thBoxC}มี${thItem} ${b} ${thItemC} มี${thItem}ทั้งหมดกี่${thItemC}`,
    ),
    answer: { value: String(a * b) },
    explanation: T(
      `There are ${a} equal groups of ${b}, so multiply: ${fact}. There are ${a * b} ${t.item}.`,
      `${b} စီပါတဲ့ အုပ်စု ${a} စု ရှိလို့ မြှောက်ပါ - ${fact}။ ${myItem} ${a * b} ${myItemC} ရှိတယ်။`,
      `มี ${a} กลุ่มเท่า ๆ กัน กลุ่มละ ${b} จึงคูณ: ${fact} มี${thItem} ${a * b} ${thItemC}`,
    ),
    hint: T('Equal groups means you can multiply.', 'အုပ်စုတွေ ညီနေရင် မြှောက်လို့ ရတယ်။', 'กลุ่มที่เท่ากันแปลว่าใช้การคูณได้'),
  });
}

export function shareEqually(rng: Rng, p: { maxGroups: number }): GeneratedQuestion {
  const groups = rng.int(2, p.maxGroups);
  const each = rng.int(2, 5);
  const total = groups * each;
  const object = rng.pick(['cookie', 'apple', 'shell', 'balloon'] as const);
  const N = NOUN[object];
  const fact = `${total} ÷ ${groups} = ${each}`;
  const check = `${groups} × ${each} = ${total}`;
  return q({
    type: 'numeric',
    prompt: T(
      `Share ${total} ${N.en} equally between ${groups} friends. How many does each friend get?`,
      `${myCount(object, total)} ကို သူငယ်ချင်း ${groups} ယောက်ကြား ညီညီမျှမျှ ခွဲဝေပါ။ သူငယ်ချင်း တစ်ယောက်စီ ဘယ်နှ${N.myC} ရလဲ။`,
      `แบ่ง${thCount(object, total)} ให้เพื่อน ${groups} คนเท่า ๆ กัน เพื่อนแต่ละคนได้กี่${N.thC}`,
    ),
    ...(total <= 20 ? { visual: { kind: 'objects' as const, object, groups: [total] } } : {}),
    answer: { value: String(each) },
    explanation: T(
      `Give one to each friend in turn until they are all gone. ${fact}, because ${check}.`,
      `ကုန်သွားတဲ့အထိ သူငယ်ချင်း တစ်ယောက်ကို တစ်ခုစီ အလှည့်ကျ ပေးပါ။ ${check} ဖြစ်လို့ ${fact}။`,
      `แจกให้เพื่อนทีละคนคนละหนึ่งจนหมด ${fact} เพราะ ${check}`,
    ),
    hint: T(`Which number times ${groups} makes ${total}?`, `ဘယ်ဂဏန်းကို ${groups} နဲ့ မြှောက်ရင် ${total} ဖြစ်လဲ။`, `จำนวนใดคูณ ${groups} ได้ ${total}`),
  });
}

export function divisionFact(rng: Rng, p: { divisors: number[]; missing?: boolean }): GeneratedQuestion {
  const d = rng.pick(p.divisors);
  const quotient = rng.int(2, 10);
  const n = d * quotient;
  if (p.missing) {
    const check = `${quotient} × ${d} = ${n}`;
    return q({
      type: 'missing_number',
      prompt: BOX_PROMPT,
      visual: { kind: 'equation', parts: [String(n), '÷', null, '=', String(quotient)] },
      answer: { value: String(d) },
      explanation: T(
        `${n} split into groups of the missing number makes ${quotient}. Since ${check}, the missing number is ${d}.`,
        `${n} ကို ပျောက်နေတဲ့ ဂဏန်းစီ အုပ်စုခွဲရင် ${quotient} စု ရတယ်။ ${check} ဖြစ်လို့ ပျောက်နေတဲ့ ဂဏန်းက ${d} ပါ။`,
        `${n} แบ่งเป็นกลุ่มละจำนวนที่หายไป ได้ ${quotient} กลุ่ม เพราะ ${check} จำนวนที่หายไปคือ ${d}`,
      ),
      hint: T(`Think: ${quotient} × what = ${n}?`, `စဉ်းစားပါ - ${quotient} × ဘာ = ${n}။`, `คิดว่า: ${quotient} × อะไร = ${n}`),
    });
  }
  const times = `${d} × ${quotient} = ${n}`;
  const fact = `${n} ÷ ${d} = ${quotient}`;
  return q({
    type: 'numeric',
    prompt: wh(`${n} ÷ ${d}`, `${n} ÷ ${d}`, `${n} ÷ ${d}`),
    answer: { value: String(quotient) },
    explanation: T(
      `Think of the times table: ${times}. So ${fact}.`,
      `အမြှောက်ဇယားကို စဉ်းစားပါ - ${times}။ ဒါကြောင့် ${fact}။`,
      `นึกถึงสูตรคูณ: ${times} ดังนั้น ${fact}`,
    ),
    hint: T(`${d} times what makes ${n}?`, `${d} ကို ဘာနဲ့ မြှောက်ရင် ${n} ဖြစ်လဲ။`, `${d} คูณอะไรได้ ${n}`),
  });
}

export function divisionStory(rng: Rng, p: { remainder: boolean }): GeneratedQuestion {
  const d = rng.int(3, 6);
  const quotient = rng.int(3, 8);
  const r = p.remainder ? rng.int(1, d - 1) : 0;
  const n = d * quotient + r;
  const name = rng.pick(NAMES);
  if (!p.remainder) {
    const fact = `${n} ÷ ${d} = ${quotient}`;
    const check = `${d} × ${quotient} = ${n}`;
    return q({
      type: 'numeric',
      prompt: T(
        `${name.en} puts ${n} books onto ${d} shelves, with the same number on each shelf. How many books go on each shelf?`,
        `${name.my} က စာအုပ် ${n} အုပ်ကို စင် ${d} ခုပေါ်မှာ တစ်ခုစီ အရေအတွက် တူအောင် တင်တယ်။ စင်တစ်ခုစီမှာ စာအုပ် ဘယ်နှအုပ် ရှိလဲ။`,
        `${name.th}วางหนังสือ ${n} เล่มบนชั้น ${d} ชั้น ชั้นละเท่า ๆ กัน แต่ละชั้นมีหนังสือกี่เล่ม`,
      ),
      answer: { value: String(quotient) },
      explanation: T(
        `Sharing equally means divide: ${fact}, because ${check}.`,
        `ညီညီမျှမျှ ခွဲဝေတာက စားခြင်းပါ - ${check} ဖြစ်လို့ ${fact}။`,
        `การแบ่งเท่า ๆ กันคือการหาร: ${fact} เพราะ ${check}`,
      ),
      hint: T('Sharing equally means dividing.', 'ညီညီမျှမျှ ခွဲဝေတာက စားခြင်းပါ။', 'การแบ่งเท่า ๆ กันคือการหาร'),
    });
  }
  const used = d * quotient;
  return q({
    type: 'numeric',
    prompt: T(
      `${n} children make teams of ${d}. How many full teams can they make?`,
      `ကလေး ${n} ယောက်က ${d} ယောက်စီ အသင်းဖွဲ့တယ်။ အသင်းပြည့် ဘယ်နှသင်း ဖွဲ့နိုင်လဲ။`,
      `เด็ก ${n} คนจัดทีม ทีมละ ${d} คน จัดได้ทีมเต็มกี่ทีม`,
    ),
    answer: { value: String(quotient) },
    explanation: T(
      `${n} ÷ ${d} = ${quotient} remainder ${r}, because ${d} × ${quotient} = ${used} and ${n} ${MINUS} ${used} = ${r}. So there are ${quotient} full teams and ${r} ${r === 1 ? 'child' : 'children'} left over.`,
      `${d} × ${quotient} = ${used} နဲ့ ${n} ${MINUS} ${used} = ${r} ဖြစ်လို့ ${n} ÷ ${d} = ${quotient} အကြွင်း ${r}။ ဒါကြောင့် အသင်းပြည့် ${quotient} သင်းနဲ့ ကလေး ${r} ယောက် ကျန်တယ်။`,
      `${n} ÷ ${d} = ${quotient} เศษ ${r} เพราะ ${d} × ${quotient} = ${used} และ ${n} ${MINUS} ${used} = ${r} จึงได้ทีมเต็ม ${quotient} ทีม และเหลือเด็ก ${r} คน`,
    ),
    hint: T(`Count in ${d}s without going past ${n}.`, `${n} ကို မကျော်ဘဲ ${d} စီ ရေပါ။`, `นับทีละ ${d} โดยไม่เกิน ${n}`),
  });
}

export function fractionShaded(rng: Rng, p: { maxParts: number }): GeneratedQuestion {
  const parts = rng.int(2, p.maxParts);
  const shaded = rng.int(1, parts - 1);
  const correct = `${shaded}/${parts}`;
  const distractors = [`${parts - shaded}/${parts}`, `${parts}/${shaded}`, `${shaded}/${parts + 1}`, `${shaded}/${parts - shaded}`];
  return q({
    type: 'multiple_choice',
    prompt: T('What fraction of the bar is shaded?', 'ဘားရဲ့ ဘယ်အပိုင်းကိန်းကို အရောင်ခြယ်ထားလဲ။', 'แถบนี้ระบายสีไปเศษส่วนเท่าไร'),
    visual: { kind: 'fraction_bar', parts, shaded },
    ...choices(rng, correct, distractors),
    explanation: T(
      `The bar has ${parts} equal parts and ${shaded} ${shaded === 1 ? 'is' : 'are'} shaded. The bottom number is the total parts, the top number is the shaded parts: ${correct}.`,
      `ဘားမှာ အပိုင်းညီ ${parts} ပိုင်း ရှိပြီး ${shaded} ပိုင်းကို အရောင်ခြယ်ထားတယ်။ အောက်ဂဏန်းက အပိုင်း စုစုပေါင်း၊ အပေါ်ဂဏန်းက အရောင်ခြယ်ထားတဲ့ အပိုင်းပါ - ${correct}။`,
      `แถบมี ${parts} ส่วนเท่า ๆ กัน ระบายสี ${shaded} ส่วน ตัวส่วนคือจำนวนส่วนทั้งหมด ตัวเศษคือส่วนที่ระบายสี: ${correct}`,
    ),
    hint: T(
      'Count all the parts, then count the shaded parts.',
      'အပိုင်းအားလုံးကို ရေပြီး အရောင်ခြယ်ထားတဲ့ အပိုင်းတွေကို ရေပါ။',
      'นับส่วนทั้งหมด แล้วนับส่วนที่ระบายสี',
    ),
  });
}

export function fractionOfNumber(rng: Rng, p: { unitOnly: boolean }): GeneratedQuestion {
  const d = rng.pick([2, 3, 4, 5, 10]);
  const unit = rng.int(2, 10);
  const n = d * unit;
  const top = p.unitOnly ? 1 : rng.int(1, d - 1);
  const answer = top * unit;
  const split = `${n} ÷ ${d} = ${unit}`;
  return q({
    type: 'numeric',
    prompt: T(`What is ${top}/${d} of ${n}?`, `${n} ရဲ့ ${top}/${d} က ဘယ်လောက်လဲ။`, `${top}/${d} ของ ${n} เท่ากับเท่าไร`),
    answer: { value: String(answer) },
    explanation:
      top === 1
        ? T(
            `Split ${n} into ${d} equal groups: ${split}. So 1/${d} of ${n} is ${unit}.`,
            `${n} ကို အုပ်စုညီ ${d} စု ခွဲပါ - ${split}။ ဒါကြောင့် ${n} ရဲ့ 1/${d} က ${unit} ပါ။`,
            `แบ่ง ${n} เป็น ${d} กลุ่มเท่า ๆ กัน: ${split} ดังนั้น 1/${d} ของ ${n} คือ ${unit}`,
          )
        : T(
            `First find 1/${d}: ${split}. Then ${top}/${d} is ${top} of those: ${top} × ${unit} = ${answer}.`,
            `အရင်ဆုံး 1/${d} ကို ရှာပါ - ${split}။ ပြီးရင် ${top}/${d} က အဲဒီလို ${top} ခုပါ - ${top} × ${unit} = ${answer}။`,
            `หา 1/${d} ก่อน: ${split} แล้ว ${top}/${d} คือ ${top} ส่วนแบบนั้น: ${top} × ${unit} = ${answer}`,
          ),
    hint: T(`Start by dividing ${n} by ${d}.`, `${n} ကို ${d} နဲ့ စားခြင်းဖြင့် စပါ။`, `เริ่มจากนำ ${n} หารด้วย ${d}`),
  });
}

export function compareFractions(rng: Rng): GeneratedQuestion {
  if (rng.next() < 0.5) {
    const d = rng.int(4, 10);
    const a = rng.int(1, d - 1);
    let b = rng.int(1, d - 1);
    while (b === a) b = rng.int(1, d - 1);
    const s = compareSymbol(a, b);
    const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
    const fact = `${a}/${d} ${s} ${b}/${d}`;
    return q({
      type: 'compare',
      prompt: SIGN_PROMPT,
      visual: { kind: 'compare', left: `${a}/${d}`, right: `${b}/${d}` },
      answer: { value: s },
      explanation: T(
        `Both fractions have ${d} equal parts. ${hi} parts is more than ${lo} parts, so ${fact}.`,
        `အပိုင်းကိန်း နှစ်ခုလုံးမှာ အပိုင်းညီ ${d} ပိုင်း ရှိတယ်။ ${hi} ပိုင်းက ${lo} ပိုင်းထက် များလို့ ${fact}။`,
        `เศษส่วนทั้งสองมี ${d} ส่วนเท่ากัน ${hi} ส่วนมากกว่า ${lo} ส่วน ดังนั้น ${fact}`,
      ),
      hint: T(
        'When the bottom numbers match, compare the top numbers.',
        'အောက်ဂဏန်းတွေ တူရင် အပေါ်ဂဏန်းတွေကို နှိုင်းယှဉ်ပါ။',
        'ถ้าตัวส่วนเท่ากัน ให้เปรียบเทียบตัวเศษ',
      ),
    });
  }
  const x = rng.int(2, 9);
  let y = rng.int(2, 9);
  while (y === x) y = rng.int(2, 9);
  const s = compareSymbol(y, x); // 1/x vs 1/y: bigger denominator, smaller piece
  const [hi, lo] = [Math.max(x, y), Math.min(x, y)];
  const fact = `1/${x} ${s} 1/${y}`;
  return q({
    type: 'compare',
    prompt: SIGN_PROMPT,
    visual: { kind: 'compare', left: `1/${x}`, right: `1/${y}` },
    answer: { value: s },
    explanation: T(
      `When a whole is cut into more parts, each part is smaller. 1/${hi} is smaller than 1/${lo}, so ${fact}.`,
      `တစ်ခုလုံးကို အပိုင်းများများ ပိုင်းလေ အပိုင်းတစ်ခုစီ ငယ်လေပါ။ 1/${hi} က 1/${lo} ထက် ငယ်လို့ ${fact}။`,
      `เมื่อแบ่งของทั้งหมดเป็นหลายส่วนขึ้น แต่ละส่วนจะเล็กลง 1/${hi} น้อยกว่า 1/${lo} ดังนั้น ${fact}`,
    ),
    hint: T(
      'Would you rather have 1 slice of a cake cut into 2 or into 8?',
      'ကိတ်မုန့်ကို 2 ပိုင်း ပိုင်းတာထဲက တစ်ပိုင်းနဲ့ 8 ပိုင်း ပိုင်းတာထဲက တစ်ပိုင်း ဘယ်ဟာ ယူချင်လဲ။',
      'อยากได้เค้ก 1 ชิ้นจากเค้กที่ตัดเป็น 2 ชิ้น หรือ 8 ชิ้น',
    ),
  });
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
  const time = label(hour, minute);
  const hourPart =
    minute === 0
      ? T(`The short hand points to ${hour}`, `လက်တံတိုက ${hour} ကို ညွှန်နေတယ်`, `เข็มสั้นชี้ที่ ${hour}`)
      : T(`The short hand is between ${hour} and ${next}`, `လက်တံတိုက ${hour} နဲ့ ${next} ကြားမှာ ရှိတယ်`, `เข็มสั้นอยู่ระหว่าง ${hour} กับ ${next}`);
  const minutePart =
    minute === 0
      ? T(
          `The long hand points to 12, which means exactly ${hour} o'clock.`,
          `လက်တံရှည်က 12 ကို ညွှန်နေလို့ ${hour} နာရီ တိတိပါ။`,
          `เข็มยาวชี้ที่ 12 แปลว่า ${hour} นาฬิกาตรง`,
        )
      : T(
          `The long hand points to ${pointsTo}. Each number is 5 minutes, so that is ${pointsTo} × 5 = ${minute} minutes.`,
          `လက်တံရှည်က ${pointsTo} ကို ညွှန်နေတယ်။ ဂဏန်းတစ်ခုစီက 5 မိနစ်ဖြစ်လို့ ${pointsTo} × 5 = ${minute} မိနစ်ပါ။`,
          `เข็มยาวชี้ที่ ${pointsTo} แต่ละตัวเลขคือ 5 นาที จึงเป็น ${pointsTo} × 5 = ${minute} นาที`,
        );
  return q({
    type: 'multiple_choice',
    prompt: T('What time does the clock show?', 'နာရီက ဘယ်အချိန်ကို ပြနေလဲ။', 'นาฬิกาบอกเวลาเท่าไร'),
    visual: { kind: 'clock', hour, minute },
    ...choices(rng, time, distractors),
    explanation: T(
      `${hourPart.en}, so the hour is ${hour}. ${minutePart.en} The time is ${time}.`,
      `${hourPart.my}၊ ဒါကြောင့် နာရီက ${hour} ပါ။ ${minutePart.my} အချိန်က ${time} ပါ။`,
      `${hourPart.th} ชั่วโมงจึงเป็น ${hour} ${minutePart.th} เวลาคือ ${time}`,
    ),
    hint: T(
      'Read the short hand for the hour, then the long hand for minutes.',
      'နာရီအတွက် လက်တံတိုကို အရင်ဖတ်ပြီး မိနစ်အတွက် လက်တံရှည်ကို ဖတ်ပါ။',
      'อ่านเข็มสั้นเพื่อดูชั่วโมง แล้วอ่านเข็มยาวเพื่อดูนาที',
    ),
  });
}

export function countCoins(rng: Rng, p: { maxCoins: number }): GeneratedQuestion {
  const n = rng.int(2, p.maxCoins);
  const coins = Array.from({ length: n }, () => rng.pick([1, 5, 10, 25] as const)).sort((a, b) => b - a);
  const total = coins.reduce((s, c) => s + c, 0);
  let running = 0;
  const steps = coins.map((c) => (running += c)).join(', ');
  return q({
    type: 'numeric',
    prompt: T('How many cents are there altogether?', 'စုစုပေါင်း ဘယ်နှဆင့် ရှိလဲ။', 'มีทั้งหมดกี่เซนต์'),
    visual: { kind: 'coins', coins },
    answer: { value: String(total) },
    explanation: T(
      `Start with the biggest coin and count on: ${steps}. That is ${total} cents (${total}¢).`,
      `အကြီးဆုံး အကြွေစေ့ကနေ စပြီး ဆက်ရေပါ - ${steps}။ ဒါက ${total} ဆင့် (${total}¢) ပါ။`,
      `เริ่มจากเหรียญที่ใหญ่ที่สุด แล้วนับต่อ: ${steps} รวมเป็น ${total} เซนต์ (${total}¢)`,
    ),
    hint: T('Start with the biggest coin, then count on.', 'အကြီးဆုံး အကြွေစေ့ကနေ စပြီး ဆက်ရေပါ။', 'เริ่มจากเหรียญที่ใหญ่ที่สุด แล้วนับต่อ'),
  });
}

export function moneyChange(rng: Rng): GeneratedQuestion {
  const paid = rng.pick([50, 100]);
  const cost = rng.int(2, paid / 5 - 1) * 5;
  const name = rng.pick(NAMES);
  const item = rng.pick([
    T('a pencil', 'ခဲတံ', 'ดินสอ'),
    T('an apple', 'ပန်းသီး', 'แอปเปิล'),
    T('a sticker', 'စတစ်ကာ', 'สติกเกอร์'),
    T('a bookmark', 'စာညှပ်', 'ที่คั่นหนังสือ'),
  ]);
  const change = paid - cost;
  const fact = `${paid} ${MINUS} ${cost} = ${change}`;
  return q({
    type: 'numeric',
    prompt: T(
      `${name.en} buys ${item.en} for ${cost}¢ and pays with ${paid}¢. How many cents of change does ${name.en} get?`,
      `${name.my} က ${item.my} ကို ${cost}¢ နဲ့ ဝယ်ပြီး ${paid}¢ ပေးတယ်။ ${name.my} ပြန်အမ်းငွေ ဘယ်နှဆင့် ရလဲ။`,
      `${name.th}ซื้อ${item.th}ราคา ${cost}¢ และจ่าย ${paid}¢ ${name.th}ได้เงินทอนกี่เซนต์`,
    ),
    answer: { value: String(change) },
    explanation: T(
      `Change is what is left: ${fact}. You can check by counting up from ${cost} to ${paid}. The change is ${change}¢.`,
      `ပြန်အမ်းငွေက ကျန်တဲ့ငွေပါ - ${fact}။ ${cost} ကနေ ${paid} အထိ ရေတွက်ပြီး စစ်နိုင်တယ်။ ပြန်အမ်းငွေက ${change}¢ ပါ။`,
      `เงินทอนคือส่วนที่เหลือ: ${fact} ตรวจได้โดยนับขึ้นจาก ${cost} ถึง ${paid} เงินทอนคือ ${change}¢`,
    ),
    hint: T(`Count up from ${cost} to ${paid}.`, `${cost} ကနေ ${paid} အထိ ရေပါ။`, `นับขึ้นจาก ${cost} ถึง ${paid}`),
  });
}

const UNIT: Record<'cm' | 'm', Tri> = { cm: T('cm', 'စင်တီမီတာ', 'ซม.'), m: T('m', 'မီတာ', 'ม.') };

export function rectanglePerimeter(rng: Rng, p: { max: number; unit: 'cm' | 'm' }): GeneratedQuestion {
  const w = rng.int(2, p.max);
  let h = rng.int(2, p.max);
  if (h === w) h = w + 1;
  const per = 2 * (w + h);
  const u = UNIT[p.unit];
  const sum = `${w} + ${h} + ${w} + ${h} = ${per}`;
  return q({
    type: 'numeric',
    prompt: T(
      `What is the perimeter of a rectangle ${w} ${u.en} long and ${h} ${u.en} wide?`,
      `အလျား ${w} ${u.my}၊ အနံ ${h} ${u.my} ရှိတဲ့ ထောင့်မှန်စတုဂံရဲ့ ပတ်လည်အနားက ဘယ်လောက်လဲ။`,
      `สี่เหลี่ยมผืนผ้ายาว ${w} ${u.th} กว้าง ${h} ${u.th} มีความยาวรอบรูปเท่าไร`,
    ),
    visual: { kind: 'rectangle', width: w, height: h, unit: p.unit },
    answer: { value: String(per) },
    explanation: T(
      `Perimeter is the distance all the way around. Add all four sides: ${sum} ${u.en}. That is the same as 2 × (${w} + ${h}).`,
      `ပတ်လည်အနားက ပုံကို တစ်ပတ်ပတ်တဲ့ အကွာအဝေးပါ။ အနား လေးခုလုံးကို ပေါင်းပါ - ${sum} ${u.my}။ ဒါက 2 × (${w} + ${h}) နဲ့ အတူတူပါပဲ။`,
      `ความยาวรอบรูปคือระยะทางรอบรูปทั้งหมด บวกทั้งสี่ด้าน: ${sum} ${u.th} เท่ากับ 2 × (${w} + ${h})`,
    ),
    hint: T(
      'A rectangle has two long sides and two short sides.',
      'ထောင့်မှန်စတုဂံမှာ အနားရှည် နှစ်ခုနဲ့ အနားတို နှစ်ခု ရှိတယ်။',
      'สี่เหลี่ยมผืนผ้ามีด้านยาวสองด้านและด้านสั้นสองด้าน',
    ),
  });
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
  const steps = `${n}/${d} = ${hundredthsValue}/100 = ${answer}`;
  return q({
    type: 'numeric',
    prompt: T(`Write ${n}/${d} as a decimal.`, `${n}/${d} ကို ဒသမကိန်းအဖြစ် ရေးပါ။`, `เขียน ${n}/${d} เป็นทศนิยม`),
    answer: { value: answer, format: 'decimal' },
    explanation: T(
      `Make the bottom number 100: multiply top and bottom by ${scale}. ${steps}.`,
      `အောက်ဂဏန်းကို 100 ဖြစ်အောင်လုပ်ပါ - အပေါ်နဲ့ အောက်ကို ${scale} နဲ့ မြှောက်ပါ။ ${steps}။`,
      `ทำตัวส่วนให้เป็น 100: คูณทั้งตัวเศษและตัวส่วนด้วย ${scale} ${steps}`,
    ),
    hint: T(`What do you multiply ${d} by to make 100?`, `${d} ကို ဘာနဲ့ မြှောက်ရင် 100 ဖြစ်လဲ။`, `${d} คูณด้วยอะไรจึงได้ 100`),
  });
}

export function decimalToFraction(rng: Rng): GeneratedQuestion {
  const tenths = rng.pick([2, 4, 5, 6, 8]);
  const value = `0.${tenths}`;
  const g = Number(gcd(BigInt(tenths), 10n));
  const simplest = `${tenths / g}/${10 / g}`;
  const steps = `${tenths}/10 = ${simplest}`;
  return q({
    type: 'numeric',
    prompt: T(
      `Write ${value} as a fraction in its simplest form.`,
      `${value} ကို အရိုးရှင်းဆုံး အပိုင်းကိန်းအဖြစ် ရေးပါ။`,
      `เขียน ${value} เป็นเศษส่วนอย่างต่ำ`,
    ),
    answer: { value: simplest, format: 'simplest_fraction' },
    explanation: T(
      `${value} means ${tenths} tenths: ${tenths}/10. Divide the top and bottom by ${g}: ${steps}.`,
      `${value} ဆိုတာ ဆယ်ပုံတစ်ပုံ ${tenths} ပုံပါ - ${tenths}/10။ အပေါ်နဲ့ အောက်ကို ${g} နဲ့ စားပါ - ${steps}။`,
      `${value} หมายถึง ${tenths} ส่วนสิบ: ${tenths}/10 หารทั้งตัวเศษและตัวส่วนด้วย ${g}: ${steps}`,
    ),
    hint: T(
      'Write it as tenths first, then simplify.',
      'ဆယ်ပုံတစ်ပုံ အဖြစ် အရင်ရေးပြီး ရိုးရှင်းအောင် လုပ်ပါ။',
      'เขียนเป็นส่วนสิบก่อน แล้วทำให้เป็นอย่างต่ำ',
    ),
  });
}

export function addFractions(rng: Rng, p: { sameDenominator: boolean }): GeneratedQuestion {
  if (p.sameDenominator) {
    const d = rng.int(5, 12);
    const a = rng.int(1, d - 2);
    const b = rng.int(1, d - a - 1);
    const sum = frac(a + b, d);
    const raw = `${a + b}/${d}`;
    const simplified = sum !== raw;
    const add = `${a} + ${b} = ${a + b}`;
    return q({
      type: 'numeric',
      prompt: wh(`${a}/${d} + ${b}/${d}`, `${a}/${d} + ${b}/${d}`, `${a}/${d} + ${b}/${d}`),
      answer: { value: raw, format: 'fraction' },
      explanation: T(
        `The bottom numbers are the same, so add the tops: ${add}. The answer is ${raw}${simplified ? `, which simplifies to ${sum}` : ''}.`,
        `အောက်ဂဏန်းတွေ တူလို့ အပေါ်ဂဏန်းတွေကို ပေါင်းပါ - ${add}။ အဖြေက ${raw}${simplified ? ` ဖြစ်ပြီး ${sum} အထိ ရိုးရှင်းအောင် လုပ်နိုင်တယ်` : ''}။`,
        `ตัวส่วนเท่ากัน จึงบวกตัวเศษ: ${add} คำตอบคือ ${raw}${simplified ? ` ซึ่งทำเป็นอย่างต่ำได้ ${sum}` : ''}`,
      ),
      hint: T('Keep the bottom number. Add the top numbers.', 'အောက်ဂဏန်းကို မပြောင်းဘဲ အပေါ်ဂဏန်းတွေကို ပေါင်းပါ။', 'ตัวส่วนคงเดิม บวกตัวเศษ'),
    });
  }
  const small = rng.pick([2, 3, 4, 5]);
  const factor = rng.pick([2, 3]);
  const big = small * factor;
  const a = 1;
  const b = rng.int(1, big - factor - 1);
  const top = a * factor + b;
  const result = frac(top, big);
  const raw = `${top}/${big}`;
  const swap = `1/${small} = ${factor}/${big}`;
  const add = `${factor}/${big} + ${b}/${big} = ${raw}${result !== raw ? ` = ${result}` : ''}`;
  return q({
    type: 'numeric',
    prompt: wh(`${a}/${small} + ${b}/${big}`, `${a}/${small} + ${b}/${big}`, `${a}/${small} + ${b}/${big}`),
    answer: { value: raw, format: 'fraction' },
    explanation: T(
      `Make the bottom numbers the same. ${swap}. Then ${add}.`,
      `အောက်ဂဏန်းတွေကို တူအောင် လုပ်ပါ။ ${swap}။ ပြီးရင် ${add}။`,
      `ทำตัวส่วนให้เท่ากัน ${swap} แล้ว ${add}`,
    ),
    hint: T(
      `Change 1/${small} into a fraction with ${big} on the bottom.`,
      `1/${small} ကို အောက်ဂဏန်း ${big} ရှိတဲ့ အပိုင်းကိန်းအဖြစ် ပြောင်းပါ။`,
      `เปลี่ยน 1/${small} เป็นเศษส่วนที่มีตัวส่วนเป็น ${big}`,
    ),
  });
}

export function decimalAddSub(rng: Rng): GeneratedQuestion {
  const a = rng.int(110, 950); // hundredths
  const b = rng.int(10, a - 10);
  const add = rng.next() < 0.5;
  const result = add ? a + b : a - b;
  const op = add ? '+' : MINUS;
  const sum = `${hundredths(a)} ${op} ${hundredths(b)}`;
  const aligned = `${(a / 100).toFixed(2)} ${op} ${(b / 100).toFixed(2)} = ${(result / 100).toFixed(2)}`;
  const answer = hundredths(result);
  return q({
    type: 'numeric',
    prompt: wh(sum, sum, sum),
    answer: { value: answer, format: 'decimal' },
    explanation: T(
      `Line up the decimal points and ${add ? 'add' : 'subtract'} each place: ${aligned}, which is ${answer}.`,
      `ဒသမအမှတ်တွေကို တန်းညှိပြီး နေရာတစ်ခုစီကို ${add ? 'ပေါင်း' : 'နုတ်'}ပါ - ${aligned}၊ ဒါက ${answer} ပါ။`,
      `ตั้งจุดทศนิยมให้ตรงกัน แล้ว${add ? 'บวก' : 'ลบ'}ทีละหลัก: ${aligned} ซึ่งก็คือ ${answer}`,
    ),
    hint: T(
      'Write both numbers with two decimal places, then line up the points.',
      'ဂဏန်းနှစ်ခုလုံးကို ဒသမနေရာ နှစ်နေရာဖြင့် ရေးပြီး အမှတ်တွေကို တန်းညှိပါ။',
      'เขียนทั้งสองจำนวนให้มีทศนิยมสองตำแหน่ง แล้วตั้งจุดให้ตรงกัน',
    ),
  });
}

export function decimalPowerOfTen(rng: Rng): GeneratedQuestion {
  const base = rng.int(11, 99); // tenths: 1.1 .. 9.9
  const power = rng.pick([10, 100]);
  const multiply = rng.next() < 0.5;
  const places = power === 10 ? T('one place', 'တစ်နေရာ', 'หนึ่งตำแหน่ง') : T('two places', 'နှစ်နေရာ', 'สองตำแหน่ง');
  if (multiply) {
    const value = hundredths(base * 10); // base/10 * power, in hundredths: base*10*power/100
    const result = formatRational(normalizeRational({ num: BigInt(base * power), den: 10n }));
    const fact = `${value} × ${power} = ${result}`;
    return q({
      type: 'numeric',
      prompt: wh(`${value} × ${power}`, `${value} × ${power}`, `${value} × ${power}`),
      answer: { value: result, format: 'decimal' },
      explanation: T(
        `Multiplying by ${power} makes a number ${power} times bigger: each digit moves ${places.en} to the left. ${fact}.`,
        `${power} နဲ့ မြှောက်ရင် ဂဏန်းက ${power} ဆ ကြီးလာတယ် - ဂဏန်းလုံးတိုင်း ဘယ်ဘက်ကို ${places.my} ရွှေ့တယ်။ ${fact}။`,
        `การคูณด้วย ${power} ทำให้จำนวนใหญ่ขึ้น ${power} เท่า: ทุกหลักเลื่อนไปทางซ้าย${places.th} ${fact}`,
      ),
      hint: T(
        `Move each digit ${places.en} to the left.`,
        `ဂဏန်းလုံးတိုင်းကို ဘယ်ဘက်ကို ${places.my} ရွှေ့ပါ။`,
        `เลื่อนทุกหลักไปทางซ้าย${places.th}`,
      ),
    });
  }
  const result = formatRational(normalizeRational({ num: BigInt(base), den: BigInt(power) }));
  const fact = `${base} ÷ ${power} = ${result}`;
  return q({
    type: 'numeric',
    prompt: wh(`${base} ÷ ${power}`, `${base} ÷ ${power}`, `${base} ÷ ${power}`),
    answer: { value: result, format: 'decimal' },
    explanation: T(
      `Dividing by ${power} makes a number ${power} times smaller: each digit moves ${places.en} to the right. ${fact}.`,
      `${power} နဲ့ စားရင် ဂဏန်းက ${power} ဆ ငယ်သွားတယ် - ဂဏန်းလုံးတိုင်း ညာဘက်ကို ${places.my} ရွှေ့တယ်။ ${fact}။`,
      `การหารด้วย ${power} ทำให้จำนวนเล็กลง ${power} เท่า: ทุกหลักเลื่อนไปทางขวา${places.th} ${fact}`,
    ),
    hint: T(
      `Move each digit ${places.en} to the right.`,
      `ဂဏန်းလုံးတိုင်းကို ညာဘက်ကို ${places.my} ရွှေ့ပါ။`,
      `เลื่อนทุกหลักไปทางขวา${places.th}`,
    ),
  });
}

export function percentGrid(rng: Rng): GeneratedQuestion {
  const shaded = rng.int(5, 95);
  return q({
    type: 'numeric',
    prompt: T(
      'What percentage of the grid is shaded? Type the number only.',
      'ဇယားကွက်ရဲ့ ဘယ်နှရာခိုင်နှုန်းကို အရောင်ခြယ်ထားလဲ။ ဂဏန်းကိုသာ ရိုက်ပါ။',
      'ตารางนี้ระบายสีไปกี่เปอร์เซ็นต์ พิมพ์เฉพาะตัวเลข',
    ),
    visual: { kind: 'percent_grid', shaded },
    answer: { value: String(shaded) },
    explanation: T(
      `The grid has 100 squares and ${shaded} are shaded. "Per cent" means "out of 100", so ${shaded} out of 100 is ${shaded}%.`,
      `ဇယားကွက်မှာ အကွက် 100 ရှိပြီး ${shaded} ကွက်ကို အရောင်ခြယ်ထားတယ်။ "ရာခိုင်နှုန်း" ဆိုတာ "100 ထဲက" လို့ အဓိပ္ပာယ်ရလို့ 100 ထဲက ${shaded} က ${shaded}% ပါ။`,
      `ตารางมี 100 ช่อง ระบายสี ${shaded} ช่อง "เปอร์เซ็นต์" แปลว่า "จาก 100" ดังนั้น ${shaded} จาก 100 คือ ${shaded}%`,
    ),
    hint: T('Each full row has 10 squares.', 'အတန်းပြည့် တစ်တန်းစီမှာ အကွက် 10 ကွက် ရှိတယ်။', 'แต่ละแถวเต็มมี 10 ช่อง'),
  });
}

export function percentOf(rng: Rng): GeneratedQuestion {
  const pct = rng.pick([10, 20, 25, 30, 50, 75]);
  const base = rng.int(2, 12) * 20;
  const answer = (pct * base) / 100;
  let explanation: Tri;
  if (pct === 50) {
    const s = `${base} ÷ 2 = ${answer}`;
    explanation = T(`50% is one half. ${s}.`, `50% က တစ်ဝက်ပါ။ ${s}။`, `50% คือครึ่งหนึ่ง ${s}`);
  } else if (pct === 25) {
    const s = `${base} ÷ 4 = ${answer}`;
    explanation = T(`25% is one quarter. ${s}.`, `25% က လေးပုံတစ်ပုံပါ။ ${s}။`, `25% คือหนึ่งในสี่ ${s}`);
  } else if (pct === 75) {
    const quarter = `${base} ÷ 4 = ${base / 4}`;
    const three = `3 × ${base / 4} = ${answer}`;
    explanation = T(
      `75% is three quarters. One quarter is ${quarter}, so three quarters is ${three}.`,
      `75% က လေးပုံသုံးပုံပါ။ လေးပုံတစ်ပုံက ${quarter} ဖြစ်လို့ လေးပုံသုံးပုံက ${three}။`,
      `75% คือสามในสี่ หนึ่งในสี่คือ ${quarter} ดังนั้นสามในสี่คือ ${three}`,
    );
  } else if (pct === 10) {
    const s = `${base} ÷ 10 = ${answer}`;
    explanation = T(`10% means divide by 10. ${s}.`, `10% ဆိုတာ 10 နဲ့ စားပါ။ ${s}။`, `10% คือหารด้วย 10 ${s}`);
  } else {
    const ten = `${base} ÷ 10 = ${base / 10}`;
    const rest = `${pct / 10} × ${base / 10} = ${answer}`;
    explanation = T(
      `First find 10%: ${ten}. Then ${pct}% is ${rest}.`,
      `အရင်ဆုံး 10% ကို ရှာပါ - ${ten}။ ပြီးရင် ${pct}% က ${rest}။`,
      `หา 10% ก่อน: ${ten} แล้ว ${pct}% คือ ${rest}`,
    );
  }
  return q({
    type: 'numeric',
    prompt: T(`What is ${pct}% of ${base}?`, `${base} ရဲ့ ${pct}% က ဘယ်လောက်လဲ။`, `${pct}% ของ ${base} เท่ากับเท่าไร`),
    answer: { value: String(answer) },
    explanation,
    hint:
      pct % 10 === 0
        ? T('Find 10% first by dividing by 10.', '10 နဲ့ စားပြီး 10% ကို အရင်ရှာပါ။', 'หา 10% ก่อนโดยหารด้วย 10')
        : T('25% is the same as one quarter.', '25% က လေးပုံတစ်ပုံနဲ့ အတူတူပါ။', '25% เท่ากับหนึ่งในสี่'),
  });
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
  const [oa, ob] = rng.shuffle(['apple', 'star', 'fish', 'shell', 'flower'] as const) as [ObjectKey, ObjectKey];
  const correct = `${x} : ${y}`;
  const divide = `${a} ÷ ${k} = ${x}`;
  const divide2 = `${b} ÷ ${k} = ${y}`;
  return q({
    type: 'multiple_choice',
    prompt: T(
      `What is the ratio of ${NOUN[oa].en} to ${NOUN[ob].en}, in its simplest form?`,
      `${NOUN[oa].my} နဲ့ ${NOUN[ob].my} ရဲ့ အချိုးကို အရိုးရှင်းဆုံးပုံစံဖြင့် ဘယ်လိုရေးမလဲ။`,
      `อัตราส่วนของ${NOUN[oa].th}ต่อ${NOUN[ob].th}ในรูปอย่างต่ำคือเท่าไร`,
    ),
    visual: { kind: 'ratio', a: { object: oa, count: a }, b: { object: ob, count: b } },
    ...choices(rng, correct, [`${y} : ${x}`, `${a} : ${b + a}`, `${x} : ${y + 1}`, `${a - 1} : ${b}`]),
    explanation: T(
      `There are ${a} ${NOUN[oa].en} and ${b} ${NOUN[ob].en}, so the ratio is ${a} : ${b}. Divide both numbers by ${k}: ${divide} and ${divide2}. The ratio is ${correct}.`,
      `${myCount(oa, a)} နဲ့ ${myCount(ob, b)} ရှိလို့ အချိုးက ${a} : ${b} ပါ။ ဂဏန်းနှစ်ခုလုံးကို ${k} နဲ့ စားပါ - ${divide} နဲ့ ${divide2}။ အချိုးက ${correct} ပါ။`,
      `มี${thCount(oa, a)} และ${thCount(ob, b)} อัตราส่วนคือ ${a} : ${b} หารทั้งสองจำนวนด้วย ${k}: ${divide} และ ${divide2} อัตราส่วนคือ ${correct}`,
    ),
    hint: T(
      'Find a number that divides both counts exactly.',
      'အရေအတွက် နှစ်ခုလုံးကို ပြတ်အောင် စားနိုင်တဲ့ ဂဏန်းကို ရှာပါ။',
      'หาจำนวนที่หารทั้งสองจำนวนได้ลงตัว',
    ),
  });
}

export function ratioShare(rng: Rng): GeneratedQuestion {
  let x = rng.int(1, 4);
  let y = rng.int(2, 5);
  while (x === y) y = rng.int(2, 5);
  const parts = x + y;
  const per = rng.int(2, 8);
  const total = parts * per;
  const [n1, n2] = rng.shuffle(NAMES).slice(0, 2) as [Tri, Tri];
  const askSecond = rng.next() < 0.5;
  const who = askSecond ? n2 : n1;
  const m = askSecond ? y : x;
  const answer = m * per;
  const partsSum = `${x} + ${y} = ${parts}`;
  const each = `${total} ÷ ${parts} = ${per}`;
  const share = `${m} × ${per} = ${answer}`;
  return q({
    type: 'numeric',
    prompt: T(
      `${n1.en} and ${n2.en} share ${total} marbles in the ratio ${x} : ${y}. How many marbles does ${who.en} get?`,
      `${n1.my} နဲ့ ${n2.my} က ဂေါ်လီလုံး ${total} လုံးကို ${x} : ${y} အချိုးနဲ့ ခွဲယူကြတယ်။ ${who.my} က ဂေါ်လီလုံး ဘယ်နှလုံး ရလဲ။`,
      `${n1.th}กับ${n2.th}แบ่งลูกแก้ว ${total} ลูกในอัตราส่วน ${x} : ${y} ${who.th}ได้ลูกแก้วกี่ลูก`,
    ),
    answer: { value: String(answer) },
    explanation: T(
      `There are ${partsSum} parts. Each part is ${each}. ${who.en} gets ${m} parts: ${share}.`,
      `အပိုင်း ${partsSum} ပိုင်း ရှိတယ်။ တစ်ပိုင်းစီက ${each}။ ${who.my} က ${m} ပိုင်း ရတယ် - ${share}။`,
      `มีทั้งหมด ${partsSum} ส่วน ส่วนละ ${each} ${who.th}ได้ ${m} ส่วน: ${share}`,
    ),
    hint: T(
      'Add the ratio numbers to find the total number of parts.',
      'အပိုင်း စုစုပေါင်းကို သိဖို့ အချိုးဂဏန်းတွေကို ပေါင်းပါ။',
      'บวกตัวเลขในอัตราส่วนเพื่อหาจำนวนส่วนทั้งหมด',
    ),
  });
}

export function compareNegatives(rng: Rng): GeneratedQuestion {
  const a = rng.int(-12, 6);
  let b = rng.int(-12, 6);
  while (b === a) b = rng.int(-12, 6);
  if (a >= 0 && b >= 0) b = -b - 1;
  const s = compareSymbol(a, b);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const fact = `${fmt(a)} ${s} ${fmt(b)}`;
  return q({
    type: 'compare',
    prompt: SIGN_PROMPT,
    visual: { kind: 'compare', left: String(a), right: String(b) },
    answer: { value: s },
    explanation: T(
      `On a number line, numbers get bigger as you go right. ${fmt(hi)} is to the right of ${fmt(lo)}, so ${fmt(hi)} is greater. That means ${fact}.`,
      `ကိန်းမျဉ်းပေါ်မှာ ညာဘက်ကို သွားလေ ဂဏန်းကြီးလေပါ။ ${fmt(hi)} က ${fmt(lo)} ရဲ့ ညာဘက်မှာ ရှိလို့ ${fmt(hi)} က ပိုကြီးတယ်။ ဒါကြောင့် ${fact}။`,
      `บนเส้นจำนวน ยิ่งไปทางขวาจำนวนยิ่งมาก ${fmt(hi)} อยู่ทางขวาของ ${fmt(lo)} ดังนั้น ${fmt(hi)} มากกว่า นั่นคือ ${fact}`,
    ),
    hint: T(
      'Picture a number line. Which number is further right?',
      'ကိန်းမျဉ်းကို စိတ်ထဲမှာ မြင်ကြည့်ပါ။ ဘယ်ဂဏန်းက ပိုညာဘက်မှာ ရှိလဲ။',
      'นึกภาพเส้นจำนวน จำนวนใดอยู่ทางขวามากกว่า',
    ),
  });
}

export function negativeArithmetic(rng: Rng, p: { subtractNegative: boolean }): GeneratedQuestion {
  if (p.subtractNegative) {
    const a = rng.int(-8, 8);
    const b = -rng.int(1, 9);
    const r = a - b;
    const sum = `${fmt(a)} ${MINUS} ${paren(b)}`;
    const steps = `${sum} = ${fmt(a)} + ${Math.abs(b)} = ${fmt(r)}`;
    return q({
      type: 'numeric',
      prompt: wh(sum, sum, sum),
      answer: { value: String(r) },
      explanation: T(
        `Subtracting a negative number is the same as adding the positive number. ${steps}.`,
        `အနုတ်ကိန်းကို နုတ်တာက အပေါင်းကိန်းကို ပေါင်းတာနဲ့ အတူတူပါ။ ${steps}။`,
        `การลบจำนวนลบเท่ากับการบวกจำนวนบวก ${steps}`,
      ),
      hint: T('Two minus signs together make a plus.', 'အနုတ်လက္ခဏာ နှစ်ခု ဆက်နေရင် အပေါင်း ဖြစ်တယ်။', 'เครื่องหมายลบสองตัวติดกันกลายเป็นบวก'),
    });
  }
  const a = rng.int(-10, 5);
  const b = rng.int(2, 12);
  const add = a < 0 ? rng.next() < 0.6 : false;
  const r = add ? a + b : a - b;
  const lo = Math.min(a, r);
  const hi = Math.max(a, r);
  const sum = `${fmt(a)} ${add ? '+' : MINUS} ${b}`;
  return q({
    type: 'numeric',
    prompt: wh(sum, sum, sum),
    visual: { kind: 'number_line', min: lo - 1, max: hi + 1, step: 1, highlight: [a], jumps: [{ from: a, to: r }] },
    answer: { value: String(r) },
    explanation: T(
      `Start at ${fmt(a)} on the number line. ${add ? 'Adding' : 'Subtracting'} ${b} means moving ${b} to the ${add ? 'right' : 'left'}. You land on ${fmt(r)}, so ${sum} = ${fmt(r)}.`,
      `ကိန်းမျဉ်းပေါ်က ${fmt(a)} မှာ စပါ။ ${b} ကို ${add ? 'ပေါင်း' : 'နုတ်'}တာက ${add ? 'ညာ' : 'ဘယ်'}ဘက်ကို ${b} ရွှေ့တာပါ။ ${fmt(r)} မှာ ရောက်လို့ ${sum} = ${fmt(r)}။`,
      `เริ่มที่ ${fmt(a)} บนเส้นจำนวน การ${add ? 'บวก' : 'ลบ'} ${b} คือเลื่อนไปทาง${add ? 'ขวา' : 'ซ้าย'} ${b} ช่อง จะถึง ${fmt(r)} ดังนั้น ${sum} = ${fmt(r)}`,
    ),
    hint: T('Adding moves right, subtracting moves left.', 'ပေါင်းရင် ညာဘက်ကို၊ နုတ်ရင် ဘယ်ဘက်ကို ရွှေ့ပါ။', 'บวกเลื่อนไปทางขวา ลบเลื่อนไปทางซ้าย'),
  });
}

export function temperatureStory(rng: Rng): GeneratedQuestion {
  const kind = rng.pick(['rise', 'fall', 'difference'] as const);
  if (kind === 'difference') {
    const high = rng.int(1, 12);
    const low = -rng.int(1, 12);
    const diff = high - low;
    const sum = `${Math.abs(low)} + ${high} = ${diff}`;
    return q({
      type: 'numeric',
      prompt: T(
        `At noon it was ${high}°C. At midnight it was ${fmt(low)}°C. How many degrees colder was it at midnight?`,
        `နေ့လယ်မှာ ${high}°C ရှိတယ်။ သန်းခေါင်မှာ ${fmt(low)}°C ရှိတယ်။ သန်းခေါင်မှာ ဘယ်နှဒီဂရီ ပိုအေးလဲ။`,
        `ตอนเที่ยงวันอุณหภูมิ ${high}°C ตอนเที่ยงคืน ${fmt(low)}°C เที่ยงคืนหนาวกว่ากี่องศา`,
      ),
      visual: { kind: 'thermometer', value: low },
      answer: { value: String(diff) },
      explanation: T(
        `From ${fmt(low)}°C up to 0°C is ${Math.abs(low)} degrees, and from 0°C up to ${high}°C is ${high} degrees. ${sum} degrees.`,
        `${fmt(low)}°C ကနေ 0°C အထိ ${Math.abs(low)} ဒီဂရီ၊ 0°C ကနေ ${high}°C အထိ ${high} ဒီဂရီ ရှိတယ်။ ${sum} ဒီဂရီ။`,
        `จาก ${fmt(low)}°C ขึ้นไปถึง 0°C คือ ${Math.abs(low)} องศา และจาก 0°C ขึ้นไปถึง ${high}°C คือ ${high} องศา ${sum} องศา`,
      ),
      hint: T(
        'Count up to 0 first, then on to the warmer temperature.',
        '0 အထိ အရင်ရေပြီး ပိုပူတဲ့ အပူချိန်အထိ ဆက်ရေပါ။',
        'นับขึ้นไปถึง 0 ก่อน แล้วนับต่อไปถึงอุณหภูมิที่อุ่นกว่า',
      ),
    });
  }
  const start = rng.int(-8, 6);
  const change = rng.int(3, 12);
  const rise = kind === 'rise';
  const end = rise ? start + change : start - change;
  const fact = `${fmt(start)} ${rise ? '+' : MINUS} ${change} = ${fmt(end)}`;
  return q({
    type: 'numeric',
    prompt: T(
      `The temperature is ${fmt(start)}°C. It ${rise ? 'rises' : 'falls'} by ${change} degrees. What is the temperature now, in °C?`,
      `အပူချိန်က ${fmt(start)}°C ရှိတယ်။ ${change} ဒီဂရီ ${rise ? 'တက်' : 'ကျ'}သွားတယ်။ အခု အပူချိန်က °C ဘယ်လောက်လဲ။`,
      `อุณหภูมิ ${fmt(start)}°C แล้ว${rise ? 'สูงขึ้น' : 'ลดลง'} ${change} องศา ตอนนี้อุณหภูมิกี่ °C`,
    ),
    visual: { kind: 'thermometer', value: start },
    answer: { value: String(end) },
    explanation: T(
      `${rise ? 'Rising means add' : 'Falling means subtract'}: ${fact}. The temperature is now ${fmt(end)}°C.`,
      `${rise ? 'တက်တာက ပေါင်းရမယ်' : 'ကျတာက နုတ်ရမယ်'} - ${fact}။ အခု အပူချိန်က ${fmt(end)}°C ပါ။`,
      `${rise ? 'สูงขึ้นแปลว่าบวก' : 'ลดลงแปลว่าลบ'}: ${fact} ตอนนี้อุณหภูมิ ${fmt(end)}°C`,
    ),
    hint: rise
      ? T('Count up the thermometer.', 'သာမိုမီတာပေါ်မှာ အပေါ်ကို ရေပါ။', 'นับขึ้นตามเทอร์โมมิเตอร์')
      : T(
          'Count down the thermometer. You may go below zero.',
          'သာမိုမီတာပေါ်မှာ အောက်ကို ရေပါ။ သုညအောက် ရောက်နိုင်တယ်။',
          'นับลงตามเทอร์โมมิเตอร์ อาจต่ำกว่าศูนย์ได้',
        ),
  });
}

const MULTIPLY_SIDES = T('Multiply the length by the width.', 'အလျားကို အနံနဲ့ မြှောက်ပါ။', 'นำความยาวคูณความกว้าง');

export function rectangleArea(rng: Rng, p: { max: number; grid: boolean }): GeneratedQuestion {
  const w = rng.int(2, p.max);
  const h = rng.int(2, p.max);
  const fact = `${w} × ${h} = ${w * h}`;
  return q({
    type: 'numeric',
    prompt: T(
      `What is the area of a rectangle ${w} cm long and ${h} cm wide, in cm²?`,
      `အလျား ${w} စင်တီမီတာ၊ အနံ ${h} စင်တီမီတာ ရှိတဲ့ ထောင့်မှန်စတုဂံရဲ့ ဧရိယာက စတုရန်းစင်တီမီတာ ဘယ်လောက်လဲ။`,
      `สี่เหลี่ยมผืนผ้ายาว ${w} ซม. กว้าง ${h} ซม. มีพื้นที่กี่ ตร.ซม.`,
    ),
    visual: { kind: 'rectangle', width: w, height: h, unit: 'cm', showGrid: p.grid },
    answer: { value: String(w * h) },
    explanation: T(
      `Area = length × width. ${fact}, so the area is ${w * h} cm². ${p.grid ? `That is ${h} rows of ${w} squares.` : ''}`.trim(),
      `ဧရိယာ = အလျား × အနံ။ ${fact} ဖြစ်လို့ ဧရိယာက ${w * h} စတုရန်းစင်တီမီတာ ပါ။${p.grid ? ` ဒါက ${w} ကွက်စီပါတဲ့ အတန်း ${h} တန်းပါ။` : ''}`,
      `พื้นที่ = ยาว × กว้าง ${fact} พื้นที่จึงเป็น ${w * h} ตร.ซม.${p.grid ? ` คือ ${h} แถว แถวละ ${w} ช่อง` : ''}`,
    ),
    hint: MULTIPLY_SIDES,
  });
}

export function triangleArea(rng: Rng): GeneratedQuestion {
  const base = rng.int(2, 9) * 2;
  const height = rng.int(3, 12);
  const area = (base * height) / 2;
  const steps = `1/2 × ${base} × ${height} = ${area}`;
  return q({
    type: 'numeric',
    prompt: T(
      `A triangle has a base of ${base} cm and a height of ${height} cm. What is its area, in cm²?`,
      `တြိဂံတစ်ခုမှာ အခြေ ${base} စင်တီမီတာနဲ့ အမြင့် ${height} စင်တီမီတာ ရှိတယ်။ ဧရိယာက စတုရန်းစင်တီမီတာ ဘယ်လောက်လဲ။`,
      `สามเหลี่ยมมีฐาน ${base} ซม. และสูง ${height} ซม. มีพื้นที่กี่ ตร.ซม.`,
    ),
    visual: { kind: 'triangle', base, height, unit: 'cm' },
    answer: { value: String(area) },
    explanation: T(
      `A triangle is half of a rectangle with the same base and height. Area = 1/2 × base × height = ${steps} cm².`,
      `တြိဂံက အခြေနဲ့ အမြင့် တူတဲ့ ထောင့်မှန်စတုဂံရဲ့ တစ်ဝက်ပါ။ ဧရိယာ = 1/2 × အခြေ × အမြင့် = ${steps} စတုရန်းစင်တီမီတာ။`,
      `สามเหลี่ยมคือครึ่งหนึ่งของสี่เหลี่ยมผืนผ้าที่มีฐานและความสูงเท่ากัน พื้นที่ = 1/2 × ฐาน × สูง = ${steps} ตร.ซม.`,
    ),
    hint: T('Find base × height, then halve it.', 'အခြေ × အမြင့် ကို ရှာပြီး တစ်ဝက်ပိုင်းပါ။', 'หาฐาน × สูง แล้วหารครึ่ง'),
  });
}

export function missingSide(rng: Rng): GeneratedQuestion {
  const w = rng.int(2, 9);
  const l = rng.int(3, 12);
  const area = w * l;
  const div = `${area} ÷ ${w} = ${l}`;
  const check = `${l} × ${w} = ${area}`;
  return q({
    type: 'numeric',
    prompt: T(
      `A rectangle has an area of ${area} cm² and a width of ${w} cm. How long is it, in cm?`,
      `ထောင့်မှန်စတုဂံတစ်ခုရဲ့ ဧရိယာက ${area} စတုရန်းစင်တီမီတာ၊ အနံက ${w} စင်တီမီတာ ဖြစ်တယ်။ အလျားက စင်တီမီတာ ဘယ်လောက်လဲ။`,
      `สี่เหลี่ยมผืนผ้ามีพื้นที่ ${area} ตร.ซม. และกว้าง ${w} ซม. ยาวกี่ ซม.`,
    ),
    answer: { value: String(l) },
    explanation: T(
      `Area = length × width, so length = area ÷ width. ${div} cm. Check: ${check}.`,
      `ဧရိယာ = အလျား × အနံ ဖြစ်လို့ အလျား = ဧရိယာ ÷ အနံ။ ${div} စင်တီမီတာ။ စစ်ကြည့်ပါ - ${check}။`,
      `พื้นที่ = ยาว × กว้าง ดังนั้น ยาว = พื้นที่ ÷ กว้าง ${div} ซม. ตรวจ: ${check}`,
    ),
    hint: T(`Which number times ${w} makes ${area}?`, `ဘယ်ဂဏန်းကို ${w} နဲ့ မြှောက်ရင် ${area} ဖြစ်လဲ။`, `จำนวนใดคูณ ${w} ได้ ${area}`),
  });
}

export function substitute(rng: Rng): GeneratedQuestion {
  const n = rng.int(2, 9);
  const a = rng.int(2, 6);
  const b = rng.int(1, 12);
  const plus = rng.next() < 0.6;
  const value = plus ? a * n + b : a * n - b;
  const op = plus ? '+' : MINUS;
  const expr = `${a}n ${op} ${b}`;
  const times = `${a} × ${n} = ${a * n}`;
  const then = `${a * n} ${op} ${b} = ${fmt(value)}`;
  return q({
    type: 'numeric',
    prompt: T(`If n = ${n}, what is ${expr}?`, `n = ${n} ဆိုရင် ${expr} က ဘယ်လောက်လဲ။`, `ถ้า n = ${n} แล้ว ${expr} เท่ากับเท่าไร`),
    answer: { value: String(value) },
    explanation: T(
      `${a}n means ${a} × n. Replace n with ${n}: ${times}. Then ${then}.`,
      `${a}n ဆိုတာ ${a} × n ပါ။ n နေရာမှာ ${n} ကို အစားထိုးပါ - ${times}။ ပြီးရင် ${then}။`,
      `${a}n หมายถึง ${a} × n แทน n ด้วย ${n}: ${times} แล้ว ${then}`,
    ),
    hint: T(`${a}n means ${a} times n.`, `${a}n ဆိုတာ ${a} ကို n နဲ့ မြှောက်တာပါ။`, `${a}n หมายถึง ${a} คูณ n`),
  });
}

const solvePrompt = (eq: string) =>
  T(`Solve: ${eq}. What is x?`, `ဖြေရှင်းပါ - ${eq}။ x က ဘာလဲ။`, `แก้สมการ: ${eq} x เท่ากับเท่าไร`);

export function solveEquation(rng: Rng, p: { twoStep: boolean }): GeneratedQuestion {
  const x = rng.int(2, 12);
  if (!p.twoStep) {
    if (rng.next() < 0.5) {
      const a = rng.int(3, 20);
      const solve = `x = ${x + a} ${MINUS} ${a} = ${x}`;
      const check = `${x} + ${a} = ${x + a}`;
      return q({
        type: 'numeric',
        prompt: solvePrompt(`x + ${a} = ${x + a}`),
        answer: { value: String(x) },
        explanation: T(
          `Subtract ${a} from both sides to get x on its own: ${solve}. Check: ${check}.`,
          `x တစ်ခုတည်း ကျန်အောင် နှစ်ဘက်လုံးကနေ ${a} နုတ်ပါ - ${solve}။ စစ်ကြည့်ပါ - ${check}။`,
          `ลบ ${a} ทั้งสองข้างเพื่อให้เหลือ x ตัวเดียว: ${solve} ตรวจ: ${check}`,
        ),
        hint: T('Do the opposite of adding.', 'ပေါင်းခြင်းရဲ့ ဆန့်ကျင်ဘက်ကို လုပ်ပါ။', 'ทำสิ่งตรงข้ามกับการบวก'),
      });
    }
    const a = rng.int(2, 9);
    const solve = `x = ${a * x} ÷ ${a} = ${x}`;
    const check = `${a} × ${x} = ${a * x}`;
    return q({
      type: 'numeric',
      prompt: solvePrompt(`${a}x = ${a * x}`),
      answer: { value: String(x) },
      explanation: T(
        `${a}x means ${a} × x. Divide both sides by ${a}: ${solve}. Check: ${check}.`,
        `${a}x ဆိုတာ ${a} × x ပါ။ နှစ်ဘက်လုံးကို ${a} နဲ့ စားပါ - ${solve}။ စစ်ကြည့်ပါ - ${check}။`,
        `${a}x หมายถึง ${a} × x หารทั้งสองข้างด้วย ${a}: ${solve} ตรวจ: ${check}`,
      ),
      hint: T('Do the opposite of multiplying.', 'မြှောက်ခြင်းရဲ့ ဆန့်ကျင်ဘက်ကို လုပ်ပါ။', 'ทำสิ่งตรงข้ามกับการคูณ'),
    });
  }
  const a = rng.int(2, 6);
  const b = rng.int(1, 15);
  const c = a * x + b;
  const step1 = `${a}x = ${c} ${MINUS} ${b} = ${a * x}`;
  const step2 = `x = ${a * x} ÷ ${a} = ${x}`;
  const check = `${a} × ${x} + ${b} = ${c}`;
  return q({
    type: 'numeric',
    prompt: solvePrompt(`${a}x + ${b} = ${c}`),
    answer: { value: String(x) },
    explanation: T(
      `First subtract ${b} from both sides: ${step1}. Then divide both sides by ${a}: ${step2}. Check: ${check}.`,
      `အရင်ဆုံး နှစ်ဘက်လုံးကနေ ${b} နုတ်ပါ - ${step1}။ ပြီးရင် နှစ်ဘက်လုံးကို ${a} နဲ့ စားပါ - ${step2}။ စစ်ကြည့်ပါ - ${check}။`,
      `ขั้นแรกลบ ${b} ทั้งสองข้าง: ${step1} แล้วหารทั้งสองข้างด้วย ${a}: ${step2} ตรวจ: ${check}`,
    ),
    hint: T(
      `Undo the + ${b} first, then undo the × ${a}.`,
      `+ ${b} ကို အရင်ဖြုတ်ပြီး × ${a} ကို ဖြုတ်ပါ။`,
      `ย้อน + ${b} ก่อน แล้วย้อน × ${a}`,
    ),
  });
}

export function multiStepStory(rng: Rng): GeneratedQuestion {
  const name = rng.pick(NAMES);
  const kind = rng.pick(['change', 'packs', 'saving'] as const);
  if (kind === 'change') {
    const price = rng.int(3, 9);
    const qty = rng.int(2, 5);
    const paid = Math.ceil((price * qty + 1) / 10) * 10;
    const change = paid - price * qty;
    const cost = `${qty} × $${price} = $${price * qty}`;
    const left = `$${paid} ${MINUS} $${price * qty} = $${change}`;
    return q({
      type: 'numeric',
      prompt: T(
        `Tickets cost $${price} each. ${name.en} buys ${qty} tickets and pays with $${paid}. How many dollars of change does ${name.en} get?`,
        `လက်မှတ်တစ်စောင် $${price} ကျတယ်။ ${name.my} က လက်မှတ် ${qty} စောင် ဝယ်ပြီး $${paid} ပေးတယ်။ ${name.my} ပြန်အမ်းငွေ ဘယ်နှဒေါ်လာ ရလဲ။`,
        `ตั๋วราคาใบละ $${price} ${name.th}ซื้อตั๋ว ${qty} ใบ และจ่าย $${paid} ${name.th}ได้เงินทอนกี่ดอลลาร์`,
      ),
      answer: { value: String(change) },
      explanation: T(
        `Step 1: total cost = ${cost}. Step 2: change = ${left}.`,
        `အဆင့် 1 - စုစုပေါင်း ကုန်ကျငွေ = ${cost}။ အဆင့် 2 - ပြန်အမ်းငွေ = ${left}။`,
        `ขั้นที่ 1: ราคารวม = ${cost} ขั้นที่ 2: เงินทอน = ${left}`,
      ),
      hint: T('First find the total cost of the tickets.', 'လက်မှတ်တွေရဲ့ စုစုပေါင်း ကုန်ကျငွေကို အရင်ရှာပါ။', 'หาราคารวมของตั๋วก่อน'),
    });
  }
  if (kind === 'packs') {
    const per = rng.pick([6, 8, 10, 12]);
    const packs = rng.int(3, 6);
    const used = rng.int(5, per * packs - 5);
    const total = `${packs} × ${per} = ${packs * per}`;
    const left = `${packs * per} ${MINUS} ${used} = ${packs * per - used}`;
    return q({
      type: 'numeric',
      prompt: T(
        `A class has ${packs} packs of ${per} pencils. They use ${used} pencils. How many pencils are left?`,
        `အတန်းတစ်တန်းမှာ ခဲတံ ${per} ချောင်းစီပါတဲ့ ထုပ် ${packs} ထုပ် ရှိတယ်။ ခဲတံ ${used} ချောင်း သုံးလိုက်တယ်။ ခဲတံ ဘယ်နှချောင်း ကျန်လဲ။`,
        `ห้องเรียนมีดินสอ ${packs} แพ็ก แพ็กละ ${per} แท่ง ใช้ไป ${used} แท่ง เหลือดินสอกี่แท่ง`,
      ),
      answer: { value: String(per * packs - used) },
      explanation: T(
        `Step 1: total pencils = ${total}. Step 2: pencils left = ${left}.`,
        `အဆင့် 1 - ခဲတံ စုစုပေါင်း = ${total}။ အဆင့် 2 - ကျန်တဲ့ ခဲတံ = ${left}။`,
        `ขั้นที่ 1: ดินสอทั้งหมด = ${total} ขั้นที่ 2: ดินสอที่เหลือ = ${left}`,
      ),
      hint: T(
        'First work out how many pencils there are altogether.',
        'ခဲတံ စုစုပေါင်း ဘယ်နှချောင်း ရှိလဲ အရင်တွက်ပါ။',
        'หาก่อนว่ามีดินสอทั้งหมดกี่แท่ง',
      ),
    });
  }
  const weekly = rng.int(3, 8);
  const weeks = rng.int(3, 8);
  const spent = rng.int(2, weekly * weeks - 2);
  const saved = `${weeks} × $${weekly} = $${weekly * weeks}`;
  const left = `$${weekly * weeks} ${MINUS} $${spent} = $${weekly * weeks - spent}`;
  return q({
    type: 'numeric',
    prompt: T(
      `${name.en} saves $${weekly} every week for ${weeks} weeks, then spends $${spent} on a book. How many dollars does ${name.en} have left?`,
      `${name.my} က အပတ်တိုင်း $${weekly} စီ ${weeks} ပတ် စုပြီး စာအုပ်တစ်အုပ်အတွက် $${spent} သုံးတယ်။ ${name.my} မှာ ဘယ်နှဒေါ်လာ ကျန်လဲ။`,
      `${name.th}เก็บเงินสัปดาห์ละ $${weekly} เป็นเวลา ${weeks} สัปดาห์ แล้วซื้อหนังสือ $${spent} ${name.th}เหลือเงินกี่ดอลลาร์`,
    ),
    answer: { value: String(weekly * weeks - spent) },
    explanation: T(
      `Step 1: savings = ${saved}. Step 2: after buying the book, ${left}.`,
      `အဆင့် 1 - စုငွေ = ${saved}။ အဆင့် 2 - စာအုပ်ဝယ်ပြီးနောက် ${left}။`,
      `ขั้นที่ 1: เงินออม = ${saved} ขั้นที่ 2: หลังซื้อหนังสือ ${left}`,
    ),
    hint: T('First find how much was saved altogether.', 'စုစုပေါင်း ဘယ်လောက် စုခဲ့လဲ အရင်ရှာပါ။', 'หาก่อนว่าเก็บเงินได้ทั้งหมดเท่าไร'),
  });
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
