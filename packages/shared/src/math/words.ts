/** English number words for the learner number chart (0 to 1000). */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1000) throw new RangeError(`numberToWords supports whole numbers 0 to 1000, got ${n}`);
  if (n === 1000) return 'one thousand';
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const ones = n % 10;
    return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[n / 10]!;
  }
  const rest = n % 100;
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  return rest ? `${hundreds} and ${numberToWords(rest)}` : hundreds;
}

/** Splits a number into place-value parts, e.g. 34 → { hundreds: 0, tens: 3, ones: 4 }. */
export function placeValue(n: number): { hundreds: number; tens: number; ones: number } {
  return { hundreds: Math.floor(n / 100), tens: Math.floor((n % 100) / 10), ones: n % 10 };
}
