import type { VisualData } from '../schemas/content';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const minus = (n: number) => (n < 0 ? `minus ${Math.abs(n)}` : String(n));

/** Plain-language description of a visual model, for screen readers on web and mobile. */
export function describeVisual(v: VisualData): string {
  switch (v.kind) {
    case 'objects': {
      const total = v.groups.reduce((s, g) => s + g, 0);
      const groups = v.groups.length > 1 ? ` in groups of ${v.groups.join(' and ')}` : '';
      const crossed = v.crossedOut ? `, ${v.crossedOut} crossed out` : '';
      return `${plural(total, v.object)}${groups}${crossed}.`;
    }
    case 'number_line': {
      const hi = v.highlight?.length ? ` Marked: ${v.highlight.map(minus).join(', ')}.` : '';
      const jumps = v.jumps?.length ? ` Jumps: ${v.jumps.map((j) => `from ${minus(j.from)} to ${minus(j.to)}`).join(', ')}.` : '';
      return `Number line from ${minus(v.min)} to ${minus(v.max)}.${hi}${jumps}`;
    }
    case 'shape':
      return `A shape.`;
    case 'shape_sequence':
      return `Shapes in a row: ${v.items.map((s) => s ?? 'blank').join(', ')}.`;
    case 'fraction_bar':
      return `A bar split into ${v.parts} equal parts with ${v.shaded} shaded.`;
    case 'clock':
      return `An analogue clock.`;
    case 'coins':
      return `Coins: ${v.coins.map((c) => `${c} cent`).join(', ')}.`;
    case 'base_ten':
      return `Base ten blocks: ${plural(v.hundreds, 'hundred')}, ${plural(v.tens, 'ten')}, ${plural(v.ones, 'one')}.`;
    case 'array':
      return `${plural(v.rows, 'row')} of ${plural(v.cols, v.object)}.`;
    case 'equation':
      return v.parts.map((p) => (p === null ? 'blank' : p === '-' ? 'minus' : p)).join(' ');
    case 'sequence':
      return `Number pattern: ${v.items.map((n) => (n === null ? 'blank' : minus(n))).join(', ')}.`;
    case 'compare':
      return `${v.left} and ${v.right}${v.object ? ` shown as ${v.object} groups` : ''}.`;
    case 'rectangle':
      return `A rectangle ${v.width} ${v.unit} long and ${v.height} ${v.unit} wide${v.showGrid ? ', drawn on a square grid' : ''}.`;
    case 'triangle':
      return `A triangle with base ${v.base} ${v.unit} and height ${v.height} ${v.unit}.`;
    case 'ruler':
      return `A ${v.object} lying along a centimetre ruler, starting at 0.`;
    case 'percent_grid':
      return `A grid of 100 squares with some shaded.`;
    case 'ratio':
      return `${plural(v.a.count, v.a.object)} and ${plural(v.b.count, v.b.object)}.`;
    case 'thermometer':
      return `A thermometer showing ${minus(v.value)} degrees Celsius.`;
  }
}
