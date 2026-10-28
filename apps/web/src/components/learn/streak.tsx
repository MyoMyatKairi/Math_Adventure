'use client';

import type { DailyGoalInfo, StreakInfo } from '@math-adventure/shared';
import { Check, Flame, Snowflake } from 'lucide-react';
import { useLocale, useT } from '@/components/i18n';
import { cn, formatDate } from '@/lib/utils';

/** Header chip: the flame is lit once today's streak day is done. */
export function StreakChip({ streak }: { streak: StreakInfo }) {
  const t = useT();
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full px-3 py-1 font-display font-extrabold tabular',
        streak.practicedToday ? 'bg-ember-soft text-ember-dark' : 'bg-line/60 text-ink-soft',
      )}
      aria-label={t('streak.label', { count: streak.current })}
    >
      <Flame className={cn('h-4 w-4', streak.practicedToday && 'fill-ember text-ember')} aria-hidden="true" />
      {streak.current}
    </div>
  );
}

/** Streak with this week's days, plus the daily goal ring. */
export function StreakCard({ streak, goal }: { streak: StreakInfo; goal: DailyGoalInfo }) {
  const t = useT();
  const locale = useLocale();
  const goalMet = goal.done >= goal.target;
  return (
    <section aria-labelledby="streak" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="streak" className="flex items-center gap-2 font-display text-lg font-extrabold">
            <Flame className={cn('h-6 w-6', streak.practicedToday ? 'fill-ember text-ember' : 'text-ink-soft')} aria-hidden="true" />
            {t('streak.label', { count: streak.current })}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t(streak.practicedToday ? 'streak.doneToday' : streak.current > 0 ? 'streak.keepGoing' : 'streak.start')}
          </p>
        </div>
        <GoalRing goal={goal} />
      </div>

      <ol aria-label={t('streak.week')} className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {streak.week.map((d, i) => {
          const day = formatDate(d.date, locale, { weekday: 'short', timeZone: 'UTC' });
          const today = i === streak.week.length - 1;
          return (
            <li key={d.date} aria-label={t(d.active ? 'streak.dayActive' : 'streak.dayMissed', { day })}>
              <span aria-hidden="true" className={cn('block text-xs font-bold', today ? 'text-ink' : 'text-ink-soft')}>
                {day}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full',
                  d.active ? 'bg-ember text-white' : 'bg-chalk',
                  today && !d.active && 'ring-2 ring-ember/50',
                )}
              >
                {d.active && <Flame className="h-4 w-4 fill-white" />}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink-soft">
        <span className="flex items-center gap-1.5" title={t('streak.freezeHelp')}>
          <Snowflake className="h-4 w-4 text-sky" aria-hidden="true" />
          {t('streak.freezes', { count: streak.freezes })}
        </span>
        {streak.longest > 0 && <span>{t('streak.longest', { count: streak.longest })}</span>}
        <span className={cn(goalMet && 'text-lagoon-dark')}>
          {t(goalMet ? 'goal.done' : 'goal.progress', { done: goal.done, target: goal.target })}
        </span>
      </div>
    </section>
  );
}

export function GoalRing({ goal, size = 64 }: { goal: DailyGoalInfo; size?: number }) {
  const t = useT();
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = goal.target > 0 ? Math.min(1, goal.done / goal.target) : 0;
  const met = p >= 1;
  return (
    <div
      role="progressbar"
      aria-label={t('goal.meter')}
      aria-valuemin={0}
      aria-valuemax={goal.target}
      aria-valuenow={Math.min(goal.done, goal.target)}
      aria-valuetext={t('goal.progress', { done: Math.min(goal.done, goal.target), target: goal.target })}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={met ? 'var(--color-lagoon)' : 'var(--color-sun)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-sm font-extrabold tabular">
        {met ? <Check className="h-6 w-6 text-lagoon-dark" /> : `${goal.done}/${goal.target}`}
      </span>
    </div>
  );
}
