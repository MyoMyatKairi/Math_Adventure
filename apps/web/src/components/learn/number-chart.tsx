'use client';

import { LOCALE_TAGS, numberToWords, placeValue } from '@math-adventure/shared';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale, useT } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { Visual } from '@/components/visuals/visual';
import { NUMBER_AUDIO_UP_TO, numberAudioUrl } from '@/lib/number-audio';
import { cn } from '@/lib/utils';

const RANGES = [10, 20, 100] as const;
type Range = (typeof RANGES)[number];

const COUNT_STEP_MS = 1300;
/** Pause after a number has been spoken before counting moves on. */
const COUNT_PAUSE_MS = 450;
/** Longest wait for speech to finish before counting moves on anyway. */
const COUNT_MAX_WAIT_MS = 4000;

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const noopSubscribe = () => () => {};

// Browsers load voices asynchronously, so keep a cache refreshed on "voiceschanged".
const NO_VOICES: SpeechSynthesisVoice[] = [];
let voiceCache = NO_VOICES;
function subscribeVoices(onChange: () => void) {
  if (!hasSpeech()) return () => {};
  const refresh = () => {
    const next = window.speechSynthesis.getVoices();
    if (next.length !== voiceCache.length) {
      voiceCache = next;
      onChange();
    }
  };
  refresh();
  window.speechSynthesis.addEventListener('voiceschanged', refresh);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
}
const getVoices = () => voiceCache;
const getNoVoices = () => NO_VOICES;

/**
 * Finds a voice that speaks the language. Setting only `utterance.lang` is not
 * enough: without a matching voice, browsers read Thai or Burmese script with
 * the default (usually English) voice, which sounds garbled or silent.
 */
function pickVoice(voices: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | null {
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  const want = norm(tag);
  const base = want.split('-')[0]!;
  const matches = voices.filter((v) => norm(v.lang) === want || norm(v.lang).split('-')[0] === base);
  return matches.find((v) => norm(v.lang) === want && v.localService) ?? matches.find((v) => norm(v.lang) === want) ?? matches[0] ?? null;
}

/** Interactive 1–100 chart: tap a number to see it, count it and hear it. */
export function NumberChart({ defaultRange = 10 }: { defaultRange?: Range }) {
  const t = useT();
  const locale = useLocale();
  const [range, setRange] = useState<Range>(defaultRange);
  const [selected, setSelected] = useState(1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([1]));
  const [countRequested, setCounting] = useState(false);
  const counting = countRequested && selected < range;
  const hasSynth = useSyncExternalStore(noopSubscribe, hasSpeech, () => false);
  const voices = useSyncExternalStore(subscribeVoices, getVoices, getNoVoices);
  const lang = locale === 'en' ? 'en-US' : LOCALE_TAGS[locale];
  const voice = pickVoice(voices, lang);
  // Until the voice list loads we can't tell, so only rule speech out once it has.
  const missingVoice = voices.length > 0 && !voice;
  const canUseVoice = hasSynth && !missingVoice;
  const hasRecordings = !!NUMBER_AUDIO_UP_TO[locale];
  const canSpeak = hasRecordings || canUseVoice;
  const [spoken, setSpoken] = useState(0);
  const tiles = useRef(new Map<number, HTMLButtonElement>());
  // Holding the utterance stops Chrome garbage-collecting it mid-word (and skipping onend).
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopSound = useCallback(() => {
    if (hasSpeech()) window.speechSynthesis.cancel();
    if (audio.current) {
      audio.current.onended = audio.current.onerror = null;
      audio.current.pause();
      audio.current = null;
    }
  }, []);

  useEffect(() => stopSound, [stopSound]);

  const sayWithVoice = useCallback(
    (n: number) => {
      if (!canUseVoice) return;
      const u = new SpeechSynthesisUtterance(numberToWords(n, locale));
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? lang;
      u.rate = 0.85;
      u.onend = () => setSpoken(n);
      utterance.current = u;
      window.speechSynthesis.speak(u);
    },
    [canUseVoice, locale, voice, lang],
  );

  // Recorded audio comes first (devices rarely have a Burmese voice); the device voice is the fallback.
  const speak = useCallback(
    (n: number) => {
      if (!canSpeak) return;
      stopSound();
      setSpoken(0);
      const url = numberAudioUrl(locale, n);
      if (!url) return sayWithVoice(n);
      const a = new Audio(url);
      a.onended = () => setSpoken(n);
      a.onerror = () => {
        audio.current = null;
        sayWithVoice(n);
      };
      audio.current = a;
      // A failed load is handled by onerror; a blocked autoplay just stays quiet.
      a.play().catch(() => {});
    },
    [canSpeak, locale, stopSound, sayWithVoice],
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
  // With speech it waits for each word to finish, since Thai and Burmese words run longer.
  useEffect(() => {
    if (!counting) return;
    const heard = canUseVoice || !!numberAudioUrl(locale, selected);
    const wait = !heard ? COUNT_STEP_MS : spoken === selected ? COUNT_PAUSE_MS : COUNT_MAX_WAIT_MS;
    const t = window.setTimeout(() => choose(selected + 1), wait);
    return () => window.clearTimeout(t);
  }, [counting, selected, spoken, canUseVoice, locale, choose]);

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

  const word = numberToWords(selected, locale);
  const pv = placeValue(selected);

  return (
    <section aria-labelledby="number-chart" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="number-chart" className="font-display text-lg font-extrabold">
            {t('chart.title')}
          </h2>
          <p className="text-sm text-ink-soft">{t('chart.lead')}</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-line bg-chalk p-1" role="radiogroup" aria-label={t('chart.rangeLabel')}>
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
                  {pv.hundreds ? t('chart.hundreds', { count: pv.hundreds }) : t('chart.tensOnes', { tens: t('chart.tens', { count: pv.tens }), ones: t('chart.ones', { count: pv.ones }) })}
                </figcaption>
              </figure>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="icon" aria-label={t('chart.previous')} disabled={selected <= 1} onClick={() => { setCounting(false); choose(selected - 1); }}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            {canSpeak && (
              <Button variant="secondary" onClick={() => speak(selected)}>
                <Volume2 className="h-5 w-5" aria-hidden="true" />
                {t('chart.hear')}
              </Button>
            )}
            <Button variant="secondary" size="icon" aria-label={t('chart.next')} disabled={selected >= range} onClick={() => { setCounting(false); choose(selected + 1); }}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          {hasSynth && missingVoice && !hasRecordings && <p className="mt-3 text-xs font-semibold text-ink-soft">{t('chart.noVoice')}</p>}
        </div>

        {/* The chart */}
        <div className="md:order-1">
          <div className={cn('grid gap-1.5', range === 100 ? 'grid-cols-10 gap-1' : 'grid-cols-5 sm:grid-cols-10')} role="group" aria-label={t('chart.numbers', { range })}>
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
                  aria-label={`${n}, ${numberToWords(n, locale)}`}
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
              {t('chart.explored', { seen: [...seen].filter((n) => n <= range).length, range })}
            </p>
            {counting ? (
              <Button variant="sun" onClick={() => setCounting(false)}>
                <Pause className="h-5 w-5" aria-hidden="true" />
                {t('chart.stop')}
              </Button>
            ) : (
              <Button variant="sun" onClick={startCounting}>
                <Play className="h-5 w-5" aria-hidden="true" />
                {t('chart.count')}
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
  const t = useT();
  const frames = n > 10 ? 2 : 1;
  return (
    <div className="flex flex-wrap justify-center gap-2" role="img" aria-label={t('chart.dots', { count: n })}>
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
