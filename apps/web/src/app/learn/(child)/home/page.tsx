import { recommendLesson, xpLevel } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, CheckCircle2, Target } from 'lucide-react';
import { BadgeMedal, WorldEmblem } from '@/components/brand/icons';
import { NumberChart } from '@/components/learn/number-chart';
import { StreakCard } from '@/components/learn/streak';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/ui/meter';
import { Stars } from '@/components/ui/stars';
import { getLocale, getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';
import { relativeDay } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('home.meta') };
}

export default async function LearnerHome() {
  const o = await requireLearner();
  const t = await getT();
  const locale = await getLocale();
  const lessons = o.worlds.flatMap((w) => w.lessons.map((l) => ({ ...l, worldId: w.id })));
  const next = recommendLesson(o.worlds, lessons);
  const nextInfo = next ? lessons.find((l) => l.id === next.id) : undefined;
  const nextWorld = next ? o.worlds.find((w) => w.id === next.worldId) : undefined;
  const currentWorld = [...o.worlds].reverse().find((w) => w.unlocked) ?? o.worlds[0];
  const earned = o.badges.filter((b) => b.awardedAt);
  const lvl = xpLevel(o.stats.totalXp);
  const isNew = o.stats.lessonsCompleted === 0;
  const resuming = nextInfo?.status === 'in_progress';

  return (
    <div className="space-y-6">
      <section className="grid gap-6 rounded-[2rem] bg-ink p-6 text-white sm:p-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-semibold text-white/70">{t(isNew ? 'home.welcome' : 'home.hiAgain', { name: o.child.displayName })}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {t(isNew ? 'home.startsHere' : resuming ? 'home.pickUp' : 'home.ready')}
          </h1>
          {nextInfo && nextWorld ? (
            <>
              <p className="mt-3 text-lg text-white/85">{t('home.nextIn', { lesson: nextInfo.title, world: nextWorld.title, minutes: nextInfo.estimatedMinutes })}</p>
              <Button asChild size="xl" variant="sun" className="mt-5">
                <Link href={`/learn/lesson/${nextInfo.id}`}>{t(resuming ? 'home.continue' : isNew ? 'home.startFirst' : 'home.start')}</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-white/85">{t('home.noLessons')}</p>
          )}
        </div>
        {currentWorld && (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/10 p-4 text-center">
            <WorldEmblem themeKey={currentWorld.themeKey} className="h-24 w-24" />
            <p className="mt-2 font-display font-bold">{currentWorld.title}</p>
            <p className="text-sm text-white/70">{t('home.lessonsOf', { done: currentWorld.completedCount, total: currentWorld.lessonCount })}</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <StreakCard streak={o.streak} goal={o.dailyGoal} />

        <section aria-labelledby="practice" className="flex flex-col rounded-3xl bg-plum-soft p-5">
          <div className="flex items-center gap-2 text-plum-dark">
            <Target className="h-5 w-5" aria-hidden="true" />
            <h2 id="practice" className="font-display text-lg font-extrabold">
              {t('practice.title')}
            </h2>
          </div>
          <p className="mt-2 flex-1">
            {!o.practice.available ? t('practice.locked') : o.practice.mistakes > 0 ? t('practice.mistakes', { count: o.practice.mistakes }) : t('practice.warmUp')}
          </p>
          {o.practice.available && (
            <Button asChild className="mt-4 self-start">
              <Link href="/learn/practice">{t('practice.start')}</Link>
            </Button>
          )}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {o.daily && (
          <section aria-labelledby="daily" className="rounded-3xl bg-sun-soft p-5">
            <div className="flex items-center gap-2 text-sun-dark">
              <Calendar className="h-5 w-5" aria-hidden="true" />
              <h2 id="daily" className="font-display text-lg font-extrabold">
                {t('home.daily')}
              </h2>
            </div>
            {o.daily.completed ? (
              <p className="mt-2 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-lagoon-dark" aria-hidden="true" />
                {t('home.dailyDone')}
              </p>
            ) : (
              <>
                <p className="mt-2">{t('home.dailyText', { lesson: o.daily.title, xp: o.daily.bonusXp })}</p>
                <Button asChild variant="sun" className="mt-4">
                  <Link href={`/learn/lesson/${o.daily.lessonId}?daily=1`}>{t('home.dailyPlay')}</Link>
                </Button>
              </>
            )}
          </section>
        )}

        <section aria-labelledby="xp" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <h2 id="xp" className="font-display text-lg font-extrabold">
            {t('home.explorerLevel', { level: lvl.level })}
          </h2>
          <p className="text-sm text-ink-soft tabular">{t('home.xpToNext', { into: lvl.intoLevel, size: lvl.levelSize, next: lvl.level + 1 })}</p>
          <Meter className="mt-3" value={lvl.intoLevel} max={lvl.levelSize} tone="plum" label={t('home.xpMeter')} />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              [t('common.lessons'), o.stats.lessonsCompleted],
              [t('common.stars'), o.stats.totalStars],
              [t('common.totalXp'), o.stats.totalXp],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-chalk py-2">
                <dt className="text-xs font-semibold text-ink-soft">{k}</dt>
                <dd className="font-display text-2xl font-extrabold tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <NumberChart defaultRange={o.child.ageGroup === '5-7' ? 10 : 100} />

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="badges" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <div className="flex items-baseline justify-between">
            <h2 id="badges" className="font-display text-lg font-extrabold">
              {t('home.badges')}
            </h2>
            <Link href="/learn/rewards" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
              {t('home.seeAll')}
            </Link>
          </div>
          {earned.length === 0 ? (
            <p className="mt-2 text-ink-soft">{t('home.noBadges')}</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-3">
              {earned.slice(0, 6).map((b) => (
                <li key={b.key} className="flex flex-col items-center gap-1 text-center">
                  <BadgeMedal iconKey={b.iconKey} earned />
                  <span className="w-20 text-xs font-semibold leading-tight">{b.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <h2 id="recent" className="font-display text-lg font-extrabold">
            {t('home.recent')}
          </h2>
          {o.recentAchievements.length === 0 ? (
            <p className="mt-2 text-ink-soft">{t('home.noRecent')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {o.recentAchievements.slice(0, 5).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{a.kind === 'badge' ? t('home.newBadge', { title: a.title }) : a.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
                    {a.kind === 'lesson' && <Stars count={a.stars} size="h-4 w-4" />}
                    {relativeDay(a.at, t, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
