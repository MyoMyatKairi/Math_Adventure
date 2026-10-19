import { describeVisual, type VisualData } from '@math-adventure/shared';
import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

type ObjectKey = Extract<VisualData, { kind: 'objects' }>['object'];
type ShapeKey = Extract<VisualData, { kind: 'shape' }>['shape'];
const INK = colors.ink;
const fmt = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** Native renderer for the shared visual models. Mirrors apps/web/src/components/visuals/visual.tsx. */
export function Visual({ visual, small }: { visual: VisualData; small?: boolean }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={describeVisual(visual)} style={{ width: '100%', alignItems: 'center' }} testID="visual">
      <View style={{ width: '100%', maxWidth: small ? 64 : 440 }}>{render(visual)}</View>
    </View>
  );
}

function render(v: VisualData) {
  switch (v.kind) {
    case 'objects':
      return <Objects object={v.object} groups={v.groups} crossedOut={v.crossedOut ?? 0} />;
    case 'number_line':
      return <NumberLine {...v} />;
    case 'shape':
      return (
        <Svg viewBox="0 0 120 120" width="100%" height={150}>
          <ShapeEl shape={v.shape} cx={60} cy={60} r={48} fill={colors.lagoonSoft} stroke={colors.lagoon} />
        </Svg>
      );
    case 'shape_sequence': {
      const c = 56;
      return (
        <Svg viewBox={`0 0 ${v.items.length * c} ${c}`} width="100%" height={70}>
          {v.items.map((s, i) =>
            s === null ? (
              <G key={i}>
                <Rect x={i * c + 6} y={6} width={c - 12} height={c - 12} rx={10} fill={colors.plumSoft} stroke={colors.plum} strokeWidth={2.5} strokeDasharray="5 4" />
                <SvgText x={i * c + c / 2} y={c / 2 + 8} textAnchor="middle" fontSize={22} fontWeight="800" fill={colors.plumDark}>
                  ?
                </SvgText>
              </G>
            ) : (
              <ShapeEl key={i} shape={s} cx={i * c + c / 2} cy={c / 2} r={19} fill={SHAPE_FILL[s]} stroke={INK} />
            ),
          )}
        </Svg>
      );
    }
    case 'fraction_bar': {
      const seg = 400 / v.parts;
      return (
        <Svg viewBox="0 0 408 70" width="100%" height={70}>
          {Array.from({ length: v.parts }, (_, i) => (
            <Rect key={i} x={4 + i * seg} y={6} width={seg} height={58} fill={i < v.shaded ? colors.plum : '#fff'} stroke={INK} strokeWidth={2.5} />
          ))}
        </Svg>
      );
    }
    case 'clock':
      return <Clock hour={v.hour} minute={v.minute} />;
    case 'coins':
      return <Coins coins={v.coins} />;
    case 'base_ten':
      return <BaseTen {...v} />;
    case 'array': {
      const c = 24;
      return (
        <Svg viewBox={`0 0 ${v.cols * c + 8} ${v.rows * c + 8}`} width="100%" height={Math.min(220, v.rows * 30)}>
          {Array.from({ length: v.rows * v.cols }, (_, i) => (
            <Obj key={i} object={v.object} x={6 + (i % v.cols) * c} y={6 + Math.floor(i / v.cols) * c} />
          ))}
        </Svg>
      );
    }
    case 'equation':
      return <Tokens tokens={v.parts.map((p) => (p === '-' ? '−' : p))} />;
    case 'sequence':
      return <Tokens tokens={v.items.map((n) => (n === null ? null : fmt(n)))} comma />;
    case 'compare':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <NumberChip text={v.left.replace('-', '−')} />
          <Blank />
          <NumberChip text={v.right.replace('-', '−')} />
        </View>
      );
    case 'rectangle': {
      const s = Math.min(300 / v.width, 160 / v.height);
      const w = v.width * s;
      const h = v.height * s;
      const ox = (380 - w) / 2;
      return (
        <Svg viewBox={`0 0 380 ${h + 70}`} width="100%" height={h * 0.8 + 60}>
          <Rect x={ox} y={20} width={w} height={h} fill={colors.lagoonSoft} stroke={colors.lagoon} strokeWidth={3} />
          {v.showGrid && Array.from({ length: v.width - 1 }, (_, i) => <Line key={`v${i}`} x1={ox + (i + 1) * s} x2={ox + (i + 1) * s} y1={20} y2={20 + h} stroke={colors.lagoon} strokeOpacity={0.4} />)}
          {v.showGrid && Array.from({ length: v.height - 1 }, (_, i) => <Line key={`h${i}`} y1={20 + (i + 1) * s} y2={20 + (i + 1) * s} x1={ox} x2={ox + w} stroke={colors.lagoon} strokeOpacity={0.4} />)}
          <SvgText x={ox + w / 2} y={20 + h + 28} textAnchor="middle" fontSize={18} fontWeight="700" fill={INK}>{`${v.width} ${v.unit}`}</SvgText>
          <SvgText x={ox + w + 8} y={20 + h / 2 + 6} fontSize={18} fontWeight="700" fill={INK}>{`${v.height} ${v.unit}`}</SvgText>
        </Svg>
      );
    }
    case 'triangle': {
      const s = Math.min(260 / v.base, 150 / v.height);
      const b = v.base * s;
      const h = v.height * s;
      const ox = (380 - b) / 2;
      const ax = ox + b * 0.35;
      return (
        <Svg viewBox={`0 0 380 ${h + 60}`} width="100%" height={h * 0.8 + 50}>
          <Polygon points={`${ox},${16 + h} ${ox + b},${16 + h} ${ax},16`} fill={colors.plumSoft} stroke={colors.plum} strokeWidth={3} />
          <Line x1={ax} x2={ax} y1={16} y2={16 + h} stroke={INK} strokeWidth={2} strokeDasharray="6 5" />
          <SvgText x={ox + b / 2} y={16 + h + 28} textAnchor="middle" fontSize={18} fontWeight="700" fill={INK}>{`base ${v.base} ${v.unit}`}</SvgText>
          <SvgText x={ax + 8} y={16 + h / 2} fontSize={18} fontWeight="700" fill={INK}>{`height ${v.height} ${v.unit}`}</SvgText>
        </Svg>
      );
    }
    case 'ruler': {
      const cm = 26;
      return (
        <Svg viewBox={`0 0 ${15 * cm + 32} 110`} width="100%" height={100}>
          <Rect x={16} y={14} width={v.length * cm} height={22} rx={6} fill={{ pencil: colors.sun, crayon: '#e64a3b', ribbon: colors.plum, worm: '#ef8fb1' }[v.object]} stroke={INK} strokeWidth={1.5} />
          <Rect x={8} y={48} width={15 * cm + 16} height={50} rx={6} fill={colors.sunSoft} stroke="#d99a0f" strokeWidth={2} />
          {Array.from({ length: 16 }, (_, i) => (
            <G key={i}>
              <Line x1={16 + i * cm} x2={16 + i * cm} y1={48} y2={66} stroke={INK} strokeWidth={2} />
              <SvgText x={16 + i * cm} y={88} textAnchor="middle" fontSize={13} fontWeight="700" fill={INK}>{String(i)}</SvgText>
            </G>
          ))}
        </Svg>
      );
    }
    case 'percent_grid':
      return (
        <Svg viewBox="0 0 224 224" width="100%" height={220}>
          {Array.from({ length: 100 }, (_, i) => (
            <Rect key={i} x={2 + (i % 10) * 22} y={2 + Math.floor(i / 10) * 22} width={22} height={22} fill={i < v.shaded ? colors.lagoon : '#fff'} stroke="#9fb3d1" strokeWidth={1} />
          ))}
        </Svg>
      );
    case 'ratio':
      return (
        <View style={{ gap: 6 }}>
          <Objects object={v.a.object} groups={[v.a.count]} crossedOut={0} />
          <Objects object={v.b.object} groups={[v.b.count]} crossedOut={0} />
        </View>
      );
    case 'thermometer':
      return <Thermometer value={v.value} />;
  }
}

function Obj({ object, x, y, crossed }: { object: ObjectKey; x: number; y: number; crossed?: boolean }) {
  const fill = OBJECT_FILL[object];
  return (
    <G x={x} y={y}>
      {object === 'block' ? (
        <Rect x={1} y={1} width={18} height={18} rx={3} fill={fill} />
      ) : object === 'star' ? (
        <Path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" fill={fill} stroke="#d99a0f" />
      ) : object === 'leaf' ? (
        <Path d="M3 17C3 8 9 3 18 3c0 9-5 14-15 14z" fill={fill} />
      ) : object === 'fish' ? (
        <Path d="M2 10c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z" fill={fill} />
      ) : object === 'balloon' ? (
        <Ellipse cx={10} cy={8} rx={6.5} ry={7.5} fill={fill} />
      ) : (
        <Circle cx={10} cy={10} r={8.5} fill={fill} />
      )}
      {crossed && <Path d="M2 2L18 18M18 2L2 18" stroke={colors.emberDark} strokeWidth={2.6} strokeLinecap="round" />}
    </G>
  );
}
const OBJECT_FILL: Record<ObjectKey, string> = {
  apple: '#e64a3b',
  star: colors.sun,
  ball: colors.sky,
  fish: colors.ember,
  leaf: '#3fb36b',
  block: colors.plum,
  shell: '#ffb4a2',
  balloon: '#ef5da8',
  cookie: '#d9a066',
  flower: '#b79cf5',
};
const SHAPE_FILL: Record<ShapeKey, string> = {
  circle: colors.lagoon,
  square: colors.plum,
  triangle: colors.ember,
  star: colors.sun,
  hexagon: colors.sky,
  rectangle: colors.lagoon,
  pentagon: colors.plum,
  oval: colors.ember,
};

function Objects({ object, groups, crossedOut }: { object: ObjectKey; groups: number[]; crossedOut: number }) {
  const cell = 26;
  const per = 5;
  const total = groups.reduce((s, g) => s + g, 0);
  const layout: { n: number; cols: number; rows: number; x: number; first: number }[] = [];
  for (let i = 0, x = 4, first = 0; i < groups.length; i++) {
    const n = groups[i]!;
    const cols = Math.max(1, Math.min(n, per));
    layout.push({ n, cols, rows: Math.max(1, Math.ceil(n / per)), x, first });
    x += cols * cell + 22;
    first += n;
  }
  const last = layout[layout.length - 1]!;
  const width = last.x + last.cols * cell + 4;
  const height = Math.max(...layout.map((g) => g.rows)) * cell + 8;
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height={Math.min(190, height * 1.6)}>
      {layout.map((g, gi) => (
        <G key={gi}>
          {Array.from({ length: g.n }, (_, i) => (
            <Obj key={i} object={object} x={g.x + (i % per) * cell + 3} y={4 + Math.floor(i / per) * cell + 3} crossed={g.first + i >= total - crossedOut} />
          ))}
        </G>
      ))}
    </Svg>
  );
}

function NumberLine({ min, max, step, highlight = [], jumps = [] }: Extract<VisualData, { kind: 'number_line' }>) {
  const count = Math.round((max - min) / step);
  const every = Math.max(1, Math.ceil(count / 10));
  const x = (n: number) => 22 + ((n - min) / (max - min || 1)) * 396;
  return (
    <Svg viewBox="0 0 440 100" width="100%" height={100}>
      <Line x1={12} x2={428} y1={70} y2={70} stroke={INK} strokeWidth={2.5} />
      {Array.from({ length: count + 1 }, (_, i) => {
        const n = Math.round((min + i * step) * 1e6) / 1e6;
        const lab = i % every === 0 || i === count;
        return (
          <G key={i}>
            <Line x1={x(n)} x2={x(n)} y1={lab ? 62 : 65} y2={lab ? 78 : 75} stroke={INK} strokeWidth={2} />
            {lab && (
              <SvgText x={x(n)} y={96} textAnchor="middle" fontSize={15} fontWeight="700" fill={INK}>
                {fmt(n)}
              </SvgText>
            )}
          </G>
        );
      })}
      {highlight.map((h) => (
        <Circle key={h} cx={x(h)} cy={70} r={8} fill={colors.lagoon} stroke="#fff" strokeWidth={2.5} />
      ))}
      {jumps.map((j, i) => {
        const mid = (x(j.from) + x(j.to)) / 2;
        const lift = Math.min(50, 14 + Math.abs(x(j.to) - x(j.from)) / 4);
        return <Path key={i} d={`M${x(j.from)} 60 Q${mid} ${60 - lift} ${x(j.to)} 60`} fill="none" stroke={colors.plum} strokeWidth={3} strokeDasharray="6 5" />;
      })}
    </Svg>
  );
}

function ShapeEl({ shape, cx, cy, r, fill, stroke }: { shape: ShapeKey; cx: number; cy: number; r: number; fill: string; stroke: string }) {
  const sw = Math.max(2, r / 12);
  const poly = (n: number, rot = -90) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
  switch (shape) {
    case 'circle':
      return <Circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'oval':
      return <Ellipse cx={cx} cy={cy} rx={r} ry={r * 0.62} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'square':
      return <Rect x={cx - r * 0.8} y={cy - r * 0.8} width={r * 1.6} height={r * 1.6} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'rectangle':
      return <Rect x={cx - r} y={cy - r * 0.6} width={r * 2} height={r * 1.2} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'triangle':
      return <Polygon points={poly(3)} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'pentagon':
      return <Polygon points={poly(5)} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'hexagon':
      return <Polygon points={poly(6, 0)} fill={fill} stroke={stroke} strokeWidth={sw} />;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      }).join(' ');
      return <Polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />;
    }
  }
}

function Clock({ hour, minute }: { hour: number; minute: number }) {
  const end = (angle: number, len: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x2: 100 + len * Math.cos(a), y2: 100 + len * Math.sin(a) };
  };
  return (
    <Svg viewBox="0 0 200 200" width="100%" height={220}>
      <Circle cx={100} cy={100} r={92} fill="#fff" stroke={INK} strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (((i + 1) * 30 - 90) * Math.PI) / 180;
        return (
          <SvgText key={i} x={100 + 66 * Math.cos(a)} y={100 + 66 * Math.sin(a) + 7} textAnchor="middle" fontSize={20} fontWeight="800" fill={INK}>
            {String(i + 1)}
          </SvgText>
        );
      })}
      <Line x1={100} y1={100} {...end(((hour % 12) + minute / 60) * 30, 44)} stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <Line x1={100} y1={100} {...end(minute * 6, 70)} stroke={colors.lagoon} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={100} cy={100} r={6} fill={INK} />
    </Svg>
  );
}

function Coins({ coins }: { coins: number[] }) {
  const size = (c: number) => ({ 1: 17, 5: 20, 10: 16, 25: 23, 100: 25 })[c] ?? 18;
  const placed: { c: number; r: number; cx: number }[] = [];
  let x = 0;
  for (const c of coins) {
    const r = size(c);
    placed.push({ c, r, cx: x + r + 4 });
    x += 2 * r + 8;
  }
  return (
    <Svg viewBox={`0 0 ${x + 4} 60`} width="100%" height={80}>
      {placed.map(({ c, r, cx }, i) => (
        <G key={i}>
          <Circle cx={cx} cy={30} r={r} fill={c === 1 ? '#d68a4a' : '#cfd6e2'} stroke="#7f8aa3" strokeWidth={2} />
          <SvgText x={cx} y={36} textAnchor="middle" fontSize={13} fontWeight="800" fill={INK}>
            {c === 100 ? '$1' : `${c}¢`}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

function BaseTen({ hundreds, tens, ones }: { hundreds: number; tens: number; ones: number }) {
  const u = 6;
  const flat = 60;
  const els = [];
  let x = 4;
  for (let i = 0; i < hundreds; i++, x += flat + 6) els.push(<Rect key={`h${i}`} x={x} y={4} width={flat} height={flat} fill={colors.sky} stroke={INK} strokeWidth={1.5} />);
  if (hundreds) x += 6;
  for (let i = 0; i < tens; i++, x += u + 4) els.push(<Rect key={`t${i}`} x={x} y={4} width={u} height={flat} fill={colors.lagoon} stroke={INK} strokeWidth={1.2} />);
  if (tens) x += 8;
  for (let i = 0; i < ones; i++) els.push(<Rect key={`o${i}`} x={x + (i % 3) * (u + 3)} y={4 + flat - u - Math.floor(i / 3) * (u + 3)} width={u} height={u} fill={colors.sun} stroke={INK} strokeWidth={1.2} />);
  x += 3 * (u + 3);
  return (
    <Svg viewBox={`0 0 ${Math.max(x, 40)} 68`} width="100%" height={120}>
      {els}
    </Svg>
  );
}

function Thermometer({ value }: { value: number }) {
  const y = (t: number) => 210 - ((t + 20) / 50) * 200;
  const c = value < 0 ? colors.sky : colors.ember;
  return (
    <Svg viewBox="0 0 140 250" width="100%" height={240}>
      <Rect x={50} y={4} width={24} height={212} rx={12} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <Circle cx={62} cy={226} r={18} fill={c} stroke={INK} strokeWidth={2.5} />
      <Rect x={56} y={y(value)} width={12} height={220 - y(value)} fill={c} />
      {Array.from({ length: 11 }, (_, i) => {
        const t = -20 + i * 5;
        return (
          <G key={t}>
            <Line x1={74} x2={t === 0 ? 92 : 84} y1={y(t)} y2={y(t)} stroke={INK} strokeWidth={t === 0 ? 2.5 : 1.5} />
            <SvgText x={96} y={y(t) + 5} fontSize={13} fontWeight="700" fill={INK}>
              {fmt(t)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function NumberChip({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 3, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 34, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] }}>{text}</Text>
    </View>
  );
}

function Blank() {
  return (
    <View style={{ minWidth: 52, height: 52, borderRadius: 14, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.plum, backgroundColor: colors.plumSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.plumDark }}>?</Text>
    </View>
  );
}

function Tokens({ tokens, comma }: { tokens: (string | null)[]; comma?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      {tokens.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {t === null ? (
            <Blank />
          ) : ['+', '−', '×', '÷', '='].includes(t) ? (
            <Text style={{ fontSize: 30, fontWeight: '900', color: colors.inkSoft }}>{t}</Text>
          ) : (
            <NumberChip text={t} />
          )}
          {comma && i < tokens.length - 1 ? <Text style={{ fontSize: 26, color: colors.inkSoft }}>,</Text> : null}
        </View>
      ))}
    </View>
  );
}
