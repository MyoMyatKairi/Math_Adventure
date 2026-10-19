import { WorldEmblem } from './icons';

/** The landing illustration: a winding dotted trail linking worlds, from forest to galaxy. */
export function Trail() {
  const stops = [
    { theme: 'forest', x: 70, y: 250, label: 'Number Forest' },
    { theme: 'village', x: 210, y: 150, label: 'Addition Village' },
    { theme: 'mountain', x: 370, y: 230, label: 'Multiplication Mountain' },
    { theme: 'ocean', x: 500, y: 110, label: 'Fraction Ocean' },
    { theme: 'galaxy', x: 640, y: 190, label: 'Geometry Galaxy' },
  ];
  const d = 'M70 250 C120 180 160 140 210 150 S320 260 370 230 S450 100 500 110 S600 220 640 190';
  return (
    <svg viewBox="0 0 720 320" className="h-auto w-full" role="img" aria-label="A trail through five worlds: Number Forest, Addition Village, Multiplication Mountain, Fraction Ocean and Geometry Galaxy.">
      <path d={d} fill="none" stroke="#9fb3d1" strokeWidth="10" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 14" />
      {stops.map((s) => (
        <g key={s.theme} transform={`translate(${s.x - 40} ${s.y - 40})`}>
          <WorldEmblem themeKey={s.theme} />
          <text x="40" y="104" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1c2541" fontFamily="ui-rounded, system-ui">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
