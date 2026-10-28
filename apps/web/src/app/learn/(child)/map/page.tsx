import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Lock, Star } from 'lucide-react';
import { WorldEmblem } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { StarIcon, Stars } from '@/components/ui/stars';
import { levelName, recommendLesson, type MapLessonInfo } from '@math-adventure/shared';
import { getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('map.meta') };
}

/** Sideways offset of each lesson node, in node widths, so the path winds. */
const WIND = [0, 0.7, 1.1, 0.7, 0, -0.7, -1.1, -0.7];

/**
 * The adventure map: one winding path through every world. Each world starts
 * with a banner; locked worlds say exactly what opens them. The suggested next
 * lesson hops and says "Start".
 */
export default async function MapPage() {
  const o = await requireLearner();
  const t = await getT();
  const lessons = o.worlds.flatMap((w) => w.lessons.map((l) => ({ ...l, worldId: w.id })));
  const current = recommendLesson(o.worlds, lessons);
  let step = 0;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold">{t('map.title')}</h1>
      <p className="text-ink-soft">{t('map.lead', { level: levelName(o.child.learningLevelId, t, o.child.levelName) })}</p>

      <div className="mx-auto mt-8 max-w-md space-y-10">
        {o.worlds.map((w, i) => {
          const prev = o.worlds[i - 1];
          const stars = w.lessons.reduce((s, l) => s + l.bestStars, 0);
          const needed = prev ? Math.max(0, prev.lessonsToUnlockNext - prev.completedCount) : 0;
          return (
            <section key={w.id} aria-labelledby={`w-${w.id}`}>
              <header
                className={cn(
                  'flex items-center gap-4 rounded-[2rem] p-4',
                  w.unlocked ? 'bg-ink text-white' : 'border-2 border-dashed border-line bg-chalk',
                )}
              >
                <WorldEmblem themeKey={w.themeKey} locked={!w.unlocked} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 id={`w-${w.id}`} className="font-display text-xl font-extrabold">
                    {w.title}
                  </h2>
                  {w.unlocked ? (
                    <>
                      <Meter
                        className="mt-2 bg-white/20"
                        value={w.completedCount}
                        max={w.lessonCount}
                        tone="sun"
                        label={t('map.meterLabel', { world: w.title, done: w.completedCount, total: w.lessonCount })}
                      />
                      <p className="mt-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-white/80">
                        <span className="flex items-center gap-1 tabular">
                          <StarIcon filled className="h-4 w-4" /> {t('map.starsOf', { count: stars, max: w.lessonCount * 3 })}
                        </span>
                        <Link href={`/learn/world/${w.id}`} className="underline underline-offset-4 hover:text-white">
                          {t('map.allLessons')}
                        </Link>
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-ink-soft">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {prev && prev.unlocked ? t('map.finishMore', { count: needed, world: prev.title }) : t('map.opensLater')}
                    </p>
                  )}
                </div>
              </header>

              <ol className="mt-6 flex flex-col items-center gap-5">
                {w.lessons.map((l) => {
                  const offset = WIND[step++ % WIND.length]!;
                  return (
                    <li key={l.id} style={{ transform: `translateX(${offset * 5}rem)` }}>
                      <PathNode lesson={l} unlocked={w.unlocked} current={current?.id === l.id} t={t} />
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PathNode({ lesson: l, unlocked, current, t }: { lesson: MapLessonInfo; unlocked: boolean; current: boolean; t: Awaited<ReturnType<typeof getT>> }) {
  const perfect = l.status === 'completed' && l.bestStars === 3;
  const status = !unlocked
    ? t('status.locked')
    : l.status === 'completed'
      ? t('status.stars', { count: l.bestStars })
      : t(l.status === 'in_progress' ? 'status.inProgress' : 'status.new');

  const circle = (
    <span
      className={cn(
        'relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 transition-transform',
        !unlocked && 'border-line bg-chalk text-ink-soft/60 shadow-[0_6px_0_0_var(--color-line)]',
        unlocked && perfect && 'border-sun bg-sun text-sun-dark shadow-[0_6px_0_0_#d99a0f]',
        unlocked && l.status === 'completed' && !perfect && 'border-lagoon bg-lagoon text-white shadow-[0_6px_0_0_var(--color-lagoon-dark)]',
        unlocked && l.status !== 'completed' && current && 'border-lagoon bg-lagoon text-white shadow-[0_6px_0_0_var(--color-lagoon-dark)] ring-8 ring-lagoon/20',
        unlocked && l.status !== 'completed' && !current && 'border-line bg-paper text-ink shadow-[0_6px_0_0_var(--color-line)]',
        unlocked && 'group-hover:-translate-y-0.5 group-active:translate-y-1 group-active:shadow-none',
      )}
    >
      {!unlocked ? (
        <Lock className="h-7 w-7" aria-hidden="true" />
      ) : l.status === 'completed' ? (
        perfect ? <Star className="h-8 w-8 fill-current" aria-hidden="true" /> : <Check className="h-8 w-8" strokeWidth={3} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="font-display text-2xl font-extrabold tabular">
          {l.displayOrder}
        </span>
      )}
    </span>
  );

  const body = (
    <>
      {current && unlocked && (
        <span aria-hidden="true" className="relative mb-2 animate-hop rounded-xl border-2 border-line bg-paper px-3 py-1 font-display text-sm font-extrabold uppercase tracking-wide text-lagoon-dark">
          {t('map.start')}
          <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-line bg-paper" />
        </span>
      )}
      {circle}
      <span className="mt-2 max-w-32 text-center text-sm font-bold leading-tight">{l.title}</span>
      {unlocked && l.status === 'completed' && <Stars count={l.bestStars} size="h-3.5 w-3.5" />}
    </>
  );

  if (!unlocked) {
    return (
      <div aria-label={t('map.lessonA11y', { title: l.title, status })} className="flex flex-col items-center opacity-80">
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/learn/lesson/${l.id}`}
      aria-label={t('map.lessonA11y', { title: l.title, status })}
      aria-current={current ? 'step' : undefined}
      className="group flex flex-col items-center rounded-3xl p-1"
    >
      {body}
    </Link>
  );
}
