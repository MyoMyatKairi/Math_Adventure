import { recommendLesson, xpLevel } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { BadgeMedal, WorldEmblem } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/ui/meter';
import { Stars } from '@/components/ui/stars';
import { requireLearner } from '@/lib/learner';
import { relativeDay } from '@/lib/utils';

export const metadata: Metadata = { title: 'Home' };

export default async function LearnerHome() {
  const o = await requireLearner();
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
          <p className="font-semibold text-white/70">{isNew ? `Welcome, ${o.child.displayName}!` : `Hi again, ${o.child.displayName}`}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {isNew ? 'Your adventure starts here' : resuming ? 'Pick up where you left off' : 'Ready for the next lesson?'}
          </h1>
          {nextInfo && nextWorld ? (
            <>
              <p className="mt-3 text-lg text-white/85">
                <span className="font-bold text-white">{nextInfo.title}</span> in {nextWorld.title}. About {nextInfo.estimatedMinutes} minutes.
              </p>
              <Button asChild size="xl" variant="sun" className="mt-5">
                <Link href={`/learn/lesson/${nextInfo.id}`}>{resuming ? 'Continue lesson' : isNew ? 'Start my first lesson' : 'Start lesson'}</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-white/85">There are no lessons in this level yet. Ask a grown-up to check your level.</p>
          )}
        </div>
        {currentWorld && (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/10 p-4 text-center">
            <WorldEmblem themeKey={currentWorld.themeKey} className="h-24 w-24" />
            <p className="mt-2 font-display font-bold">{currentWorld.title}</p>
            <p className="text-sm text-white/70">
              {currentWorld.completedCount} of {currentWorld.lessonCount} lessons
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {o.daily && (
          <section aria-labelledby="daily" className="rounded-3xl bg-sun-soft p-5">
            <div className="flex items-center gap-2 text-sun-dark">
              <Calendar className="h-5 w-5" aria-hidden="true" />
              <h2 id="daily" className="font-display text-lg font-extrabold">
                Today&apos;s challenge
              </h2>
            </div>
            {o.daily.completed ? (
              <p className="mt-2 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-lagoon-dark" aria-hidden="true" />
                Done for today! A new challenge arrives tomorrow.
              </p>
            ) : (
              <>
                <p className="mt-2">
                  <span className="font-bold">{o.daily.title}</span>. Finish it for {o.daily.bonusXp} bonus XP.
                </p>
                <Button asChild variant="sun" className="mt-4">
                  <Link href={`/learn/lesson/${o.daily.lessonId}?daily=1`}>Play today&apos;s challenge</Link>
                </Button>
              </>
            )}
          </section>
        )}

        <section aria-labelledby="xp" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <h2 id="xp" className="font-display text-lg font-extrabold">
            Explorer level {lvl.level}
          </h2>
          <p className="text-sm text-ink-soft tabular">
            {lvl.intoLevel} of {lvl.levelSize} XP to level {lvl.level + 1}
          </p>
          <Meter className="mt-3" value={lvl.intoLevel} max={lvl.levelSize} tone="plum" label="Experience towards the next level" />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Lessons', o.stats.lessonsCompleted],
              ['Stars', o.stats.totalStars],
              ['Total XP', o.stats.totalXp],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-chalk py-2">
                <dt className="text-xs font-semibold text-ink-soft">{k}</dt>
                <dd className="font-display text-2xl font-extrabold tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="badges" className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <div className="flex items-baseline justify-between">
            <h2 id="badges" className="font-display text-lg font-extrabold">
              Badges
            </h2>
            <Link href="/learn/rewards" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
              See all
            </Link>
          </div>
          {earned.length === 0 ? (
            <p className="mt-2 text-ink-soft">Finish your first lesson to earn the First Steps badge.</p>
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
            Recent achievements
          </h2>
          {o.recentAchievements.length === 0 ? (
            <p className="mt-2 text-ink-soft">Your finished lessons and new badges will show up here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {o.recentAchievements.slice(0, 5).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{a.kind === 'badge' ? `New badge: ${a.title}` : a.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
                    {a.kind === 'lesson' && <Stars count={a.stars} size="h-4 w-4" />}
                    {relativeDay(a.at)}
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
