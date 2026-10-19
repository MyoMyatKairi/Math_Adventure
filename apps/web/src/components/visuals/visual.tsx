import { describeVisual, type VisualData } from '@math-adventure/shared';
import { cn } from '@/lib/utils';

type ObjectKey = Extract<VisualData, { kind: 'objects' }>['object'];
type ShapeKey = Extract<VisualData, { kind: 'shape' }>['shape'];

const INK = '#1c2541';

/** Renders a structured visual model. Each one carries a text description for screen readers. */
export function Visual({ visual, className, size = 'md' }: { visual: VisualData; className?: string; size?: 'sm' | 'md' }) {
  return (
    <figure className={cn('flex justify-center', className)} role="img" aria-label={describeVisual(visual)}>
      <div aria-hidden="true" className={cn('w-full', size === 'sm' ? 'max-w-[220px]' : 'max-w-[440px]')}>
        {renderVisual(visual)}
      </div>
    </figure>
  );
}

function renderVisual(v: VisualData): React.ReactNode {
  switch (v.kind) {
    case 'objects':
      return <ObjectGroups object={v.object} groups={v.groups} crossedOut={v.crossedOut ?? 0} />;
    case 'number_line':
      return <NumberLine {...v} />;
    case 'shape':
      return (
        <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36">
          <ShapePath shape={v.shape} cx={60} cy={60} r={48} fill="#dcf5f2" stroke="#0e9f94" />
        </svg>
      );
    case 'shape_sequence':
      return <ShapeSequence items={v.items} />;
    case 'fraction_bar':
      return <FractionBar parts={v.parts} shaded={v.shaded} />;
    case 'clock':
      return <Clock hour={v.hour} minute={v.minute} />;
    case 'coins':
      return <Coins coins={v.coins} />;
    case 'base_ten':
      return <BaseTen {...v} />;
    case 'array':
      return <ArrayGrid rows={v.rows} cols={v.cols} object={v.object} />;
    case 'equation':
      return <TokenRow tokens={v.parts.map((p) => (p === '-' ? '−' : p))} />;
    case 'sequence':
      return <TokenRow tokens={v.items.map((n) => (n === null ? null : fmt(n)))} separator="," />;
    case 'compare':
      return <Compare {...v} />;
    case 'rectangle':
      return <Rectangle {...v} />;
    case 'triangle':
      return <Triangle {...v} />;
    case 'ruler':
      return <Ruler length={v.length} object={v.object} />;
    case 'percent_grid':
      return <PercentGrid shaded={v.shaded} />;
    case 'ratio':
      return (
        <div className="space-y-2">
          <ObjectGroups object={v.a.object} groups={[v.a.count]} crossedOut={0} />
          <ObjectGroups object={v.b.object} groups={[v.b.count]} crossedOut={0} />
        </div>
      );
    case 'thermometer':
      return <Thermometer value={v.value} />;
  }
}

const fmt = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export function ObjectIcon({ object, x, y, s = 20, crossed }: { object: ObjectKey; x: number; y: number; s?: number; crossed?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 20})`}>
      {OBJECT_ART[object]}
      {crossed && <path d="M2 2L18 18M18 2L2 18" stroke="#a3510c" strokeWidth="2.6" strokeLinecap="round" />}
    </g>
  );
}

const OBJECT_ART: Record<ObjectKey, React.ReactNode> = {
  apple: (
    <>
      <path d="M10 5c-4-2-8 0-8 6 0 5 4 8 8 8s8-3 8-8c0-6-4-8-8-6z" fill="#e64a3b" />
      <path d="M10 5c0-2 1-3 3-4" stroke="#7a5230" strokeWidth="1.5" fill="none" />
      <path d="M11 4c2-2 4-1 5 0-2 1-3 1-5 0z" fill="#2f9a5b" />
    </>
  ),
  star: <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" fill="#ffc23d" stroke="#d99a0f" strokeWidth="1" />,
  ball: (
    <>
      <circle cx="10" cy="10" r="8.5" fill="#4f8fe8" />
      <path d="M2 10h17M10 1.5c-4 4-4 13 0 17" stroke="#fff" strokeWidth="1.5" fill="none" />
    </>
  ),
  fish: (
    <>
      <path d="M2 10c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z" fill="#e8781e" />
      <circle cx="6" cy="9" r="1.2" fill={INK} />
    </>
  ),
  leaf: (
    <>
      <path d="M3 17C3 8 9 3 18 3c0 9-5 14-15 14z" fill="#3fb36b" />
      <path d="M3 17L13 8" stroke="#2f9a5b" strokeWidth="1.3" />
    </>
  ),
  block: <rect x="2" y="2" width="16" height="16" rx="2" fill="#7c5ce0" stroke="#5b3fc0" strokeWidth="1.2" />,
  shell: (
    <>
      <path d="M10 2c5 0 8 5 8 10l-8 6-8-6c0-5 3-10 8-10z" fill="#ffb4a2" />
      <path d="M10 2v15M6 4l2 13M14 4l-2 13" stroke="#e8781e" strokeWidth="1" />
    </>
  ),
  balloon: (
    <>
      <ellipse cx="10" cy="8" rx="6.5" ry="7.5" fill="#ef5da8" />
      <path d="M10 15.5c-1 2 1 2 0 4" stroke={INK} strokeWidth="0.9" fill="none" />
    </>
  ),
  cookie: (
    <>
      <circle cx="10" cy="10" r="8.5" fill="#d9a066" />
      <circle cx="7" cy="7" r="1.3" fill="#6d4b2f" />
      <circle cx="13" cy="9" r="1.3" fill="#6d4b2f" />
      <circle cx="9" cy="13.5" r="1.3" fill="#6d4b2f" />
    </>
  ),
  flower: (
    <>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={10 + 5 * Math.cos((a * Math.PI) / 180)} cy={10 + 5 * Math.sin((a * Math.PI) / 180)} r="3.8" fill="#b79cf5" />
      ))}
      <circle cx="10" cy="10" r="3" fill="#ffc23d" />
    </>
  ),
};

/** Groups laid out in rows of five (like a ten frame), with a gap between groups. */
function ObjectGroups({ object, groups, crossedOut }: { object: ObjectKey; groups: number[]; crossedOut: number }) {
  const cell = 26;
  const perRow = 5;
  const layouts = groups.map((n) => ({ n, rows: Math.max(1, Math.ceil(n / perRow)), cols: Math.min(n, perRow) || 1 }));
  const width = layouts.reduce((w, g) => w + g.cols * cell, 0) + (layouts.length - 1) * 22 + 8;
  const height = Math.max(...layouts.map((g) => g.rows)) * cell + 8;
  const total = groups.reduce((s, g) => s + g, 0);
  // Precompute each group's x offset and the running index of its first item.
  const placed: { x: number; first: number }[] = [];
  for (let i = 0, x = 4, first = 0; i < layouts.length; i++) {
    placed.push({ x, first });
    x += layouts[i]!.cols * cell + 22;
    first += layouts[i]!.n;
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto max-h-48 w-full">
      {layouts.map((g, gi) => {
        const { x, first } = placed[gi]!;
        return (
          <g key={gi}>
            {layouts.length > 1 && <rect x={x - 2} y={2} width={g.cols * cell + 4} height={g.rows * cell + 4} rx="8" fill="none" stroke="#d9e2f0" strokeWidth="2" />}
            {Array.from({ length: g.n }, (_, i) => (
              <ObjectIcon
                key={i}
                object={object}
                x={x + (i % perRow) * cell + 3}
                y={4 + Math.floor(i / perRow) * cell + 3}
                crossed={first + i >= total - crossedOut}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function ArrayGrid({ rows, cols, object }: { rows: number; cols: number; object: ObjectKey }) {
  const cell = 24;
  return (
    <svg viewBox={`0 0 ${cols * cell + 8} ${rows * cell + 8}`} className="mx-auto max-h-56 w-full">
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => <ObjectIcon key={`${r}-${c}`} object={object} x={4 + c * cell + 2} y={4 + r * cell + 2} />),
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Number line, tokens, compare
// ---------------------------------------------------------------------------

function NumberLine({ min, max, step, highlight = [], jumps = [] }: Extract<VisualData, { kind: 'number_line' }>) {
  const count = Math.round((max - min) / step);
  const labelEvery = Math.max(1, Math.ceil(count / 12));
  const width = 440;
  const pad = 22;
  const x = (n: number) => pad + ((n - min) / (max - min || 1)) * (width - 2 * pad);
  const y = 70;
  return (
    <svg viewBox={`0 0 ${width} 100`} className="w-full">
      <defs>
        <marker id="nl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#7c5ce0" />
        </marker>
      </defs>
      <line x1={pad - 10} x2={width - pad + 10} y1={y} y2={y} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {Array.from({ length: count + 1 }, (_, i) => {
        const n = Math.round((min + i * step) * 1e6) / 1e6;
        const labelled = i % labelEvery === 0 || i === count;
        return (
          <g key={i}>
            <line x1={x(n)} x2={x(n)} y1={y - (labelled ? 8 : 5)} y2={y + (labelled ? 8 : 5)} stroke={INK} strokeWidth="2" />
            {labelled && (
              <text x={x(n)} y={y + 26} textAnchor="middle" fontSize="15" fontWeight="700" fill={INK} fontFamily="system-ui">
                {fmt(n)}
              </text>
            )}
          </g>
        );
      })}
      {highlight.map((h) => (
        <circle key={h} cx={x(h)} cy={y} r="8" fill="#0e9f94" stroke="#fff" strokeWidth="2.5" />
      ))}
      {jumps.map((j, i) => {
        const mid = (x(j.from) + x(j.to)) / 2;
        const lift = Math.min(50, 14 + Math.abs(x(j.to) - x(j.from)) / 4);
        return (
          <path
            key={i}
            d={`M${x(j.from)} ${y - 10} Q${mid} ${y - 10 - lift} ${x(j.to)} ${y - 10}`}
            fill="none"
            stroke="#7c5ce0"
            strokeWidth="3"
            strokeDasharray="6 5"
            markerEnd="url(#nl-arrow)"
          />
        );
      })}
    </svg>
  );
}

function TokenRow({ tokens, separator }: { tokens: (string | null)[]; separator?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 font-display text-4xl font-extrabold tabular">
      {tokens.map((t, i) => (
        <span key={i} className="flex items-center">
          {t === null ? (
            <span className="inline-flex h-14 min-w-14 items-center justify-center rounded-xl border-[3px] border-dashed border-plum bg-plum-soft px-2 text-plum-dark">?</span>
          ) : ['+', '−', '×', '÷', '='].includes(t) ? (
            <span className="px-1 text-ink-soft">{t}</span>
          ) : (
            <span className="rounded-xl bg-paper px-3 py-1 shadow-[0_2px_0_0_var(--color-line)]">{t}</span>
          )}
          {separator && i < tokens.length - 1 && <span className="ml-1 text-ink-soft">{separator}</span>}
        </span>
      ))}
    </div>
  );
}

function Compare({ left, right, object }: Extract<VisualData, { kind: 'compare' }>) {
  const showObjects = object && /^\d+$/.test(left) && /^\d+$/.test(right) && Number(left) <= 20 && Number(right) <= 20;
  const side = (n: string) => (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="rounded-2xl bg-paper px-5 py-2 font-display text-5xl font-extrabold tabular shadow-[0_3px_0_0_var(--color-line)]">
        {n.replace('-', '−')}
      </span>
      {showObjects && <ObjectGroups object={object!} groups={[Number(n)]} crossedOut={0} />}
    </div>
  );
  return (
    <div className="flex items-start justify-center gap-3">
      {side(left)}
      <span className="mt-2 inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-dashed border-plum bg-plum-soft font-display text-3xl font-extrabold text-plum-dark">
        ?
      </span>
      {side(right)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shapes and geometry
// ---------------------------------------------------------------------------

export function ShapePath({ shape, cx, cy, r, fill, stroke }: { shape: ShapeKey; cx: number; cy: number; r: number; fill: string; stroke: string }) {
  const common = { fill, stroke, strokeWidth: Math.max(2, r / 12), strokeLinejoin: 'round' as const };
  const poly = (n: number, rot = -90) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r} {...common} />;
    case 'oval':
      return <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.62} {...common} />;
    case 'square':
      return <rect x={cx - r * 0.8} y={cy - r * 0.8} width={r * 1.6} height={r * 1.6} {...common} />;
    case 'rectangle':
      return <rect x={cx - r} y={cy - r * 0.6} width={r * 2} height={r * 1.2} {...common} />;
    case 'triangle':
      return <polygon points={poly(3)} {...common} />;
    case 'pentagon':
      return <polygon points={poly(5)} {...common} />;
    case 'hexagon':
      return <polygon points={poly(6, 0)} {...common} />;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      }).join(' ');
      return <polygon points={pts} {...common} />;
    }
  }
}

const SHAPE_COLORS = ['#0e9f94', '#7c5ce0', '#e8781e', '#4f8fe8', '#d99a0f'];
export function shapeColor(shape: ShapeKey) {
  return SHAPE_COLORS[['circle', 'square', 'triangle', 'star', 'hexagon', 'rectangle', 'pentagon', 'oval'].indexOf(shape) % SHAPE_COLORS.length]!;
}

function ShapeSequence({ items }: { items: (ShapeKey | null)[] }) {
  const cell = 56;
  return (
    <svg viewBox={`0 0 ${items.length * cell} ${cell}`} className="w-full">
      {items.map((s, i) =>
        s === null ? (
          <g key={i}>
            <rect x={i * cell + 6} y={6} width={cell - 12} height={cell - 12} rx="10" fill="#eee9fd" stroke="#7c5ce0" strokeWidth="2.5" strokeDasharray="5 4" />
            <text x={i * cell + cell / 2} y={cell / 2 + 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#5b3fc0" fontFamily="system-ui">
              ?
            </text>
          </g>
        ) : (
          <ShapePath key={i} shape={s} cx={i * cell + cell / 2} cy={cell / 2} r={19} fill={shapeColor(s)} stroke={INK} />
        ),
      )}
    </svg>
  );
}

function FractionBar({ parts, shaded }: { parts: number; shaded: number }) {
  const w = 400;
  const seg = w / parts;
  return (
    <svg viewBox={`0 0 ${w + 8} 70`} className="w-full">
      {Array.from({ length: parts }, (_, i) => (
        <rect key={i} x={4 + i * seg} y={6} width={seg} height={58} fill={i < shaded ? '#7c5ce0' : '#fff'} stroke={INK} strokeWidth="2.5" />
      ))}
    </svg>
  );
}

function PercentGrid({ shaded }: { shaded: number }) {
  const c = 22;
  return (
    <svg viewBox={`0 0 ${10 * c + 4} ${10 * c + 4}`} className="mx-auto max-h-60 w-full">
      {Array.from({ length: 100 }, (_, i) => (
        <rect key={i} x={2 + (i % 10) * c} y={2 + Math.floor(i / 10) * c} width={c} height={c} fill={i < shaded ? '#0e9f94' : '#fff'} stroke="#9fb3d1" strokeWidth="1" />
      ))}
    </svg>
  );
}

function Rectangle({ width, height, unit, showGrid }: Extract<VisualData, { kind: 'rectangle' }>) {
  const scale = Math.min(300 / width, 160 / height);
  const w = width * scale;
  const h = height * scale;
  const ox = (380 - w) / 2;
  const oy = 20;
  return (
    <svg viewBox={`0 0 380 ${h + 70}`} className="w-full">
      <rect x={ox} y={oy} width={w} height={h} fill="#dcf5f2" stroke="#0e9f94" strokeWidth="3" />
      {showGrid &&
        Array.from({ length: width - 1 }, (_, i) => <line key={`v${i}`} x1={ox + (i + 1) * scale} x2={ox + (i + 1) * scale} y1={oy} y2={oy + h} stroke="#0e9f94" strokeOpacity="0.4" />)}
      {showGrid &&
        Array.from({ length: height - 1 }, (_, i) => <line key={`h${i}`} y1={oy + (i + 1) * scale} y2={oy + (i + 1) * scale} x1={ox} x2={ox + w} stroke="#0e9f94" strokeOpacity="0.4" />)}
      <text x={ox + w / 2} y={oy + h + 28} textAnchor="middle" fontSize="18" fontWeight="700" fill={INK} fontFamily="system-ui">
        {width} {unit}
      </text>
      <text x={ox + w + 10} y={oy + h / 2 + 6} fontSize="18" fontWeight="700" fill={INK} fontFamily="system-ui">
        {height} {unit}
      </text>
    </svg>
  );
}

function Triangle({ base, height, unit }: Extract<VisualData, { kind: 'triangle' }>) {
  const scale = Math.min(260 / base, 150 / height);
  const b = base * scale;
  const h = height * scale;
  const ox = (380 - b) / 2;
  const apexX = ox + b * 0.35;
  const top = 16;
  return (
    <svg viewBox={`0 0 380 ${h + 60}`} className="w-full">
      <polygon points={`${ox},${top + h} ${ox + b},${top + h} ${apexX},${top}`} fill="#eee9fd" stroke="#7c5ce0" strokeWidth="3" strokeLinejoin="round" />
      <line x1={apexX} x2={apexX} y1={top} y2={top + h} stroke={INK} strokeWidth="2" strokeDasharray="6 5" />
      <rect x={apexX} y={top + h - 12} width="12" height="12" fill="none" stroke={INK} strokeWidth="1.5" />
      <text x={ox + b / 2} y={top + h + 28} textAnchor="middle" fontSize="18" fontWeight="700" fill={INK} fontFamily="system-ui">
        base {base} {unit}
      </text>
      <text x={apexX + 8} y={top + h / 2} fontSize="18" fontWeight="700" fill={INK} fontFamily="system-ui">
        height {height} {unit}
      </text>
    </svg>
  );
}

function Ruler({ length, object }: { length: number; object: 'pencil' | 'crayon' | 'ribbon' | 'worm' }) {
  const cm = 26;
  const x0 = 16;
  const colors = { pencil: '#ffc23d', crayon: '#e64a3b', ribbon: '#7c5ce0', worm: '#ef8fb1' };
  return (
    <svg viewBox={`0 0 ${15 * cm + 32} 110`} className="w-full">
      {object === 'pencil' ? (
        <g>
          <rect x={x0} y={14} width={length * cm - 18} height={22} fill={colors.pencil} stroke={INK} strokeWidth="1.5" />
          <path d={`M${x0 + length * cm - 18} 14l18 11-18 11z`} fill="#f5d9b0" stroke={INK} strokeWidth="1.5" />
        </g>
      ) : object === 'worm' ? (
        <path d={`M${x0 + 10} 25h${length * cm - 20}`} stroke={colors.worm} strokeWidth="18" strokeLinecap="round" />
      ) : (
        <rect x={x0} y={14} width={length * cm} height={22} rx={object === 'crayon' ? 6 : 2} fill={colors[object]} stroke={INK} strokeWidth="1.5" />
      )}
      <rect x={x0 - 8} y={48} width={15 * cm + 16} height={50} rx="6" fill="#fff3d6" stroke="#d99a0f" strokeWidth="2" />
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i}>
          <line x1={x0 + i * cm} x2={x0 + i * cm} y1={48} y2={66} stroke={INK} strokeWidth="2" />
          <text x={x0 + i * cm} y={88} textAnchor="middle" fontSize="13" fontWeight="700" fill={INK} fontFamily="system-ui">
            {i}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Clock({ hour, minute }: { hour: number; minute: number }) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  const hand = (angle: number, len: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x2: 100 + len * Math.cos(a), y2: 100 + len * Math.sin(a) };
  };
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-56 w-56">
      <circle cx="100" cy="100" r="92" fill="#fff" stroke={INK} strokeWidth="6" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = ((i * 6 - 90) * Math.PI) / 180;
        const r1 = i % 5 === 0 ? 76 : 82;
        return <line key={i} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + 86 * Math.cos(a)} y2={100 + 86 * Math.sin(a)} stroke={INK} strokeWidth={i % 5 === 0 ? 3 : 1} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const a = ((n * 30 - 90) * Math.PI) / 180;
        return (
          <text key={n} x={100 + 62 * Math.cos(a)} y={100 + 62 * Math.sin(a) + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill={INK} fontFamily="system-ui">
            {n}
          </text>
        );
      })}
      <line x1="100" y1="100" {...hand(hourAngle, 44)} stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <line x1="100" y1="100" {...hand(minuteAngle, 70)} stroke="#0e9f94" strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="6" fill={INK} />
    </svg>
  );
}

function Coins({ coins }: { coins: number[] }) {
  const size = (c: number) => ({ 1: 17, 5: 20, 10: 16, 25: 23, 100: 25 })[c] ?? 18;
  const fill = (c: number) => (c === 1 ? '#d68a4a' : c === 100 ? '#e9c25a' : '#cfd6e2');
  const placed: { c: number; r: number; cx: number }[] = [];
  let x = 0;
  for (const c of coins) {
    const r = size(c);
    placed.push({ c, r, cx: x + r + 4 });
    x += 2 * r + 8;
  }
  return (
    <svg viewBox={`0 0 ${x + 4} 60`} className="mx-auto max-h-24 w-full">
      {placed.map(({ c, r, cx }, i) => (
        <g key={i}>
          <circle cx={cx} cy={30} r={r} fill={fill(c)} stroke="#7f8aa3" strokeWidth="2" />
          <text x={cx} y={36} textAnchor="middle" fontSize={c >= 10 ? 14 : 13} fontWeight="800" fill={INK} fontFamily="system-ui">
            {c === 100 ? '$1' : `${c}¢`}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BaseTen({ hundreds, tens, ones }: { hundreds: number; tens: number; ones: number }) {
  const u = 6;
  const flat = 10 * u;
  let x = 4;
  const els: React.ReactNode[] = [];
  for (let i = 0; i < hundreds; i++) {
    const ox = x;
    els.push(
      <g key={`h${i}`}>
        <rect x={ox} y={4} width={flat} height={flat} fill="#4f8fe8" stroke={INK} strokeWidth="1.5" />
        {Array.from({ length: 9 }, (_, k) => (
          <g key={k}>
            <line x1={ox + (k + 1) * u} x2={ox + (k + 1) * u} y1={4} y2={4 + flat} stroke="#cfe1fb" strokeWidth="0.7" />
            <line y1={4 + (k + 1) * u} y2={4 + (k + 1) * u} x1={ox} x2={ox + flat} stroke="#cfe1fb" strokeWidth="0.7" />
          </g>
        ))}
      </g>,
    );
    x += flat + 6;
  }
  if (hundreds) x += 6;
  for (let i = 0; i < tens; i++) {
    const ox = x;
    els.push(
      <g key={`t${i}`}>
        <rect x={ox} y={4} width={u} height={flat} fill="#0e9f94" stroke={INK} strokeWidth="1.2" />
        {Array.from({ length: 9 }, (_, k) => (
          <line key={k} x1={ox} x2={ox + u} y1={4 + (k + 1) * u} y2={4 + (k + 1) * u} stroke="#dcf5f2" strokeWidth="0.7" />
        ))}
      </g>,
    );
    x += u + 4;
  }
  if (tens) x += 8;
  for (let i = 0; i < ones; i++) {
    els.push(<rect key={`o${i}`} x={x + (i % 3) * (u + 3)} y={4 + flat - u - Math.floor(i / 3) * (u + 3)} width={u} height={u} fill="#ffc23d" stroke={INK} strokeWidth="1.2" />);
  }
  x += 3 * (u + 3);
  return (
    <svg viewBox={`0 0 ${Math.max(x, 40)} ${flat + 8}`} className="mx-auto max-h-44 w-full">
      {els}
    </svg>
  );
}

function Thermometer({ value }: { value: number }) {
  const min = -20;
  const max = 30;
  const top = 10;
  const bottom = 210;
  const y = (t: number) => bottom - ((t - min) / (max - min)) * (bottom - top);
  return (
    <svg viewBox="0 0 140 250" className="mx-auto h-64">
      <rect x="50" y={top - 6} width="24" height={bottom - top + 12} rx="12" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="62" cy={bottom + 16} r="18" fill={value < 0 ? '#4f8fe8' : '#e8781e'} stroke={INK} strokeWidth="2.5" />
      <rect x="56" y={y(value)} width="12" height={bottom + 10 - y(value)} fill={value < 0 ? '#4f8fe8' : '#e8781e'} />
      {Array.from({ length: 11 }, (_, i) => {
        const t = min + i * 5;
        return (
          <g key={t}>
            <line x1="74" x2={t === 0 ? 92 : 84} y1={y(t)} y2={y(t)} stroke={INK} strokeWidth={t === 0 ? 2.5 : 1.5} />
            <text x="96" y={y(t) + 5} fontSize="13" fontWeight={t === 0 ? 800 : 600} fill={INK} fontFamily="system-ui">
              {fmt(t)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
