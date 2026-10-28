'use client';

import { useEffect, useState } from 'react';

const COLORS = ['var(--color-sun)', 'var(--color-lagoon)', 'var(--color-plum)', 'var(--color-ember)', 'var(--color-sky)'];

/**
 * A one-off confetti shower over the whole screen. Hidden for reduced motion.
 * Only render it after a user action (never in server-rendered markup): the layout is random.
 */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [bits] = useState<React.CSSProperties[]>(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      width: 8 + Math.random() * 6,
      height: 10 + Math.random() * 8,
      background: COLORS[i % COLORS.length],
      borderRadius: i % 3 === 0 ? '999px' : '2px',
      ['--drift' as string]: `${(Math.random() - 0.5) * 160}px`,
      ['--spin' as string]: `${360 + Math.random() * 540}deg`,
      ['--fall' as string]: `${2 + Math.random() * 1.6}s`,
      ['--delay' as string]: `${Math.random() * 0.5}s`,
    })),
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((style, i) => (
        <span key={i} className="confetti-piece" style={style} />
      ))}
    </div>
  );
}

/** Counts up from 0 to `value` once, quickly. Shows the final value straight away for reduced motion. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [still] = useState(() => typeof window === 'undefined' || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still || value <= 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, value, duration]);
  return <>{still || value <= 0 ? value : shown}</>;
}
