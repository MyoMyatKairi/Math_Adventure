'use client';

import { numberToWords, placeValue } from '@math-adventure/shared';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Visual } from '@/components/visuals/visual';
import { cn } from '@/lib/utils';

const RANGES = [10, 20, 100] as const;
type Range = (typeof RANGES)[number];

const COUNT_STEP_MS = 1300;

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const noopSubscribe = () => () => {};

/** Interactive 1–100 chart: tap a number to see it, count it and hear it. */
export function NumberChart({ defaultRange = 10 }: { defaultRange?: Range }) {
  const [range, setRange] = useState<Range>(defaultRange);
  const [selected, setSelected] = useState(1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([1]));
  const [countRequested, setCounting] = useState(false);
  const counting = countRequested && selected < range;
  const canSpeak = useSyncExternalStore(noopSubscribe, hasSpeech, () => false);
  const tiles = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => () => {
    if (hasSpeech()) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (n: number) => {
      if (!canSpeak) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(numberToWords(n));
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    },
    [canSpeak],
  );

  const choose = useCallback(
    (n: number, opts: { say?: boolean } = {}) => {
      setSelected(n);
      setSeen((s) => (s.has(n) ? s : new Set(s).add(n)));
      if (opts.say !== false) speak(n);
    },
    [speak],
  );

  // "Count with me" walks through the chart one number at a time and stops at the end.
  useEffect(() => {
    if (!counting) return;
    const t = window.setTimeout(() => choose(selected + 1), COUNT_STEP_MS);
    return () => window.clearTimeout(t);
  }, [counting, selected, choose]);

  function startCounting() {
    choose(1);
    setCounting(true);
  }

  function changeRange(r: Range) {
    setRange(r);
    setCounting(false);
    if (selected > r) choose(1, { say: false });
  }

  const cols = range === 100 ? 10 : 5;
  function onTileKey(e: React.KeyboardEvent, n: number) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = n + step;
    if (next < 1 || next > range) return;
    setCounting(false);
    choose(next);
    tiles.current.get(next)?.focus();
  }

  const word = numberToWords(selected);
  const pv = placeValue(selected);

  return (
    <section aria-labelledby="number-chart" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="number-chart" className="font-display text-lg font-extrabold">
            Number chart
          </h2>
          <p className="text-sm text-ink-soft">Tap a number to see it, count it and hear it.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-line bg-chalk p-1" role="radiogroup" aria-label="Numbers to show">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => changeRange(r)}
              className={cn(
                'h-9 rounded-lg px-3 text-sm font-bold tabular transition-colors',
                range === r ? 'bg-paper text-lagoon-dark ring-2 ring-lagoon' : 'text-ink-soft hover:text-ink',
              )}
            >
              1–{r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Spotlight on the chosen number */}
        <div className="flex flex-col items-center rounded-2xl bg-sun-soft p-4 text-center md:order-2" aria-live="polite">
          <p className="font-display text-7xl font-extrabold leading-none tabular text-ink">{selected}</p>
          <p className="mt-2 font-display text-xl font-bold capitalize text-sun-dark">{word}</p>
          <div className="mt-4 flex w-full min-h-24 items-center justify-center">
            {selected <= 20 ? (
              <TenFrames n={selected} />
            ) : (
              <figure className="w-full">
                <Visual visual={{ kind: 'base_ten', ...pv }} size="sm" />
                <figcaption className="mt-1 text-sm font-semibold text-ink-soft">
                  {pv.hundreds ? `${pv.hundreds} hundred` : `${pv.tens} ${pv.tens === 1 ? 'ten' : 'tens'} and ${pv.ones} ${pv.ones === 1 ? 'one' : 'ones'}`}
                </figcaption>
              </figure>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="icon" aria-label="Previous number" disabled={selected <= 1} onClick={() => { setCounting(false); choose(selected - 1); }}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            {canSpeak && (
              <Button variant="secondary" onClick={() => speak(selected)}>
                <Volume2 className="h-5 w-5" aria-hidden="true" />
                Hear it
              </Button>
            )}
            <Button variant="secondary" size="icon" aria-label="Next number" disabled={selected >= range} onClick={() => { setCounting(false); choose(selected + 1); }}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* The chart */}
        <div className="md:order-1">
          <div className={cn('grid gap-1.5', range === 100 ? 'grid-cols-10 gap-1' : 'grid-cols-5 sm:grid-cols-10')} role="group" aria-label={`Numbers 1 to ${range}`}>
            {Array.from({ length: range }, (_, i) => i + 1).map((n) => {
              const isSel = n === selected;
              return (
                <button
                  key={n}
                  ref={(el) => {
                    if (el) tiles.current.set(n, el);
                    else tiles.current.delete(n);
                  }}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`${n}, ${numberToWords(n)}`}
                  tabIndex={isSel ? 0 : -1}
                  onClick={() => {
                    setCounting(false);
                    choose(n);
                  }}
                  onKeyDown={(e) => onTileKey(e, n)}
                  className={cn(
                    'aspect-square rounded-lg font-display font-bold tabular transition-colors',
                    range === 100 ? 'text-xs sm:text-base' : 'text-xl',
                    isSel
                      ? 'bg-lagoon text-white shadow-[0_3px_0_0_var(--color-lagoon-dark)]'
                      : seen.has(n)
                        ? 'bg-lagoon-soft text-lagoon-dark hover:bg-lagoon/20'
                        : n % 10 === 0
                          ? 'bg-sky-soft text-ink hover:bg-sky/20'
                          : 'bg-chalk text-ink hover:bg-line',
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink-soft tabular">
              Explored {[...seen].filter((n) => n <= range).length} of {range}
            </p>
            {counting ? (
              <Button variant="sun" onClick={() => setCounting(false)}>
                <Pause className="h-5 w-5" aria-hidden="true" />
                Stop counting
              </Button>
            ) : (
              <Button variant="sun" onClick={startCounting}>
                <Play className="h-5 w-5" aria-hidden="true" />
                Count with me
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One or two ten frames showing the quantity as dots. */
function TenFrames({ n }: { n: number }) {
  const frames = n > 10 ? 2 : 1;
  return (
    <div className="flex flex-wrap justify-center gap-2" role="img" aria-label={`${n} ${n === 1 ? 'dot' : 'dots'}`}>
      {Array.from({ length: frames }, (_, f) => (
        <div key={f} className="grid grid-cols-5 gap-1 rounded-lg border-2 border-ink/70 bg-paper p-1">
          {Array.from({ length: 10 }, (_, i) => {
            const filled = f * 10 + i < n;
            return (
              <span key={i} className="grid h-6 w-6 place-items-center rounded-sm bg-chalk">
                {filled && <span className="animate-pop h-4.5 w-4.5 rounded-full bg-ember" />}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
