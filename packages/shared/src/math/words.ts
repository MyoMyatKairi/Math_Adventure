import type { Locale } from '../i18n/locales';

/** Number words for the learner number chart (0 to 1000), in English, Burmese and Thai. */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function english(n: number): string {
  if (n === 1000) return 'one thousand';
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const ones = n % 10;
    return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[n / 10]!;
  }
  const rest = n % 100;
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  return rest ? `${hundreds} and ${english(rest)}` : hundreds;
}

// Burmese: ဆယ် (ten), ရာ (hundred) and ထောင် (thousand) take the creaky tone (့)
// when more of the number follows, e.g. 25 = နှစ်ဆယ့်ငါး, 105 = တစ်ရာ့ငါး.
const MY_DIGITS = ['သုည', 'တစ်', 'နှစ်', 'သုံး', 'လေး', 'ငါး', 'ခြောက်', 'ခုနစ်', 'ရှစ်', 'ကိုး'];

function burmese(n: number): string {
  if (n === 1000) return 'တစ်ထောင်';
  if (n < 10) return MY_DIGITS[n]!;
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  let out = '';
  if (h) out += `${MY_DIGITS[h]}${t || o ? 'ရာ့' : 'ရာ'}`;
  if (t) out += `${t === 1 && !h ? '' : MY_DIGITS[t]}${o ? 'ဆယ့်' : 'ဆယ်'}`;
  if (t === 1 && !h && !o) out = 'တစ်ဆယ်';
  if (o) out += MY_DIGITS[o];
  return out;
}

// Thai: 1 in the ones place after tens is เอ็ด (21 = ยี่สิบเอ็ด), 20 is ยี่สิบ, 10 is สิบ.
const TH_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

function thai(n: number): string {
  if (n === 1000) return 'หนึ่งพัน';
  if (n < 10) return TH_DIGITS[n]!;
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  let out = '';
  if (h) out += `${TH_DIGITS[h]}ร้อย`;
  if (t) out += `${t === 1 ? '' : t === 2 ? 'ยี่' : TH_DIGITS[t]}สิบ`;
  if (o) out += o === 1 && t ? 'เอ็ด' : TH_DIGITS[o];
  return out;
}

export function numberToWords(n: number, locale: Locale = 'en'): string {
  if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError(`numberToWords supports whole numbers 0 to 1000, got ${n}`);
  if (locale === 'my') return burmese(n);
  if (locale === 'th') return thai(n);
  return english(n);
}

/** Splits a number into place-value parts, e.g. 34 → { hundreds: 0, tens: 3, ones: 4 }. */
export function placeValue(n: number): { hundreds: number; tens: number; ones: number } {
  return { hundreds: Math.floor(n / 100), tens: Math.floor((n % 100) / 10), ones: n % 10 };
}
