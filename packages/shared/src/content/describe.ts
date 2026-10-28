import type { Locale } from '../i18n/locales';
import { translate, type MessageKey } from '../i18n/translate';
import type { VisualData } from '../schemas/content';

/** Plain-language description of a visual model, for screen readers on web and mobile. */
export function describeVisual(v: VisualData, locale: Locale = 'en'): string {
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const num = (n: number) => (n < 0 ? t('visual.minus', { n: Math.abs(n) }) : String(n));
  const list = (items: string[]) => items.join(t('visual.list'));
  const things = (object: string, count: number) => t(`noun.${object}` as MessageKey, { count });
  const unit = (u: string) => t(`visual.unit.${u}` as MessageKey);

  switch (v.kind) {
    case 'objects': {
      const total = v.groups.reduce((s, g) => s + g, 0);
      return t('visual.objects', {
        things: things(v.object, total),
        groups: v.groups.length > 1 ? t('visual.inGroups', { groups: v.groups.join(t('visual.and')) }) : '',
        crossed: v.crossedOut ? t('visual.crossed', { count: v.crossedOut }) : '',
      });
    }
    case 'number_line':
      return t('visual.numberLine', {
        min: num(v.min),
        max: num(v.max),
        marked: v.highlight?.length ? t('visual.marked', { list: list(v.highlight.map(num)) }) : '',
        jumps: v.jumps?.length ? t('visual.jumps', { list: list(v.jumps.map((j) => t('visual.jump', { from: num(j.from), to: num(j.to) }))) }) : '',
      });
    case 'shape':
      return t('visual.shape');
    case 'shape_sequence':
      return t('visual.shapes', { list: list(v.items.map((s) => (s ? t(`shape.${s}` as MessageKey) : t('visual.blank')))) });
    case 'fraction_bar':
      return t('visual.fractionBar', { parts: v.parts, shaded: v.shaded });
    case 'clock':
      return t('visual.clock');
    case 'coins':
      return t('visual.coins', { list: list(v.coins.map((c) => t('visual.coin', { n: c }))) });
    case 'base_ten':
      return t('visual.baseTen', { hundreds: v.hundreds, tens: v.tens, ones: v.ones });
    case 'array':
      return t('visual.array', { count: v.rows, rows: v.rows, things: things(v.object, v.cols) });
    case 'equation':
      return v.parts.map((p) => (p === null ? t('visual.blank') : p === '-' ? t('visual.equationMinus') : p)).join(' ');
    case 'sequence':
      return t('visual.sequence', { list: list(v.items.map((n) => (n === null ? t('visual.blank') : num(n)))) });
    case 'compare':
      return v.object
        ? t('visual.compareObjects', { left: v.left, right: v.right, object: t(`noun.plain.${v.object}` as MessageKey) })
        : t('visual.compare', { left: v.left, right: v.right });
    case 'rectangle':
      return t(v.showGrid ? 'visual.rectangleGrid' : 'visual.rectangle', { w: v.width, h: v.height, unit: unit(v.unit) });
    case 'triangle':
      return t('visual.triangle', { b: v.base, h: v.height, unit: unit(v.unit) });
    case 'ruler':
      return t('visual.ruler', { object: t(`visual.ruler.${v.object}` as MessageKey) });
    case 'percent_grid':
      return t('visual.percentGrid');
    case 'ratio':
      return t('visual.ratio', { a: things(v.a.object, v.a.count), b: things(v.b.object, v.b.count) });
    case 'thermometer':
      return t('visual.thermometer', { value: num(v.value) });
  }
}
