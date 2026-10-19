import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { WorldEmblem } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { StarIcon } from '@/components/ui/stars';
import { requireLearner } from '@/lib/learner';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Adventure map' };

/** The adventure map: worlds along a winding trail. Locked worlds say exactly what opens them. */
export default async function MapPage() {
  const o = await requireLearner();
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold">Adventure map</h1>
      <p className="text-ink-soft">{o.child.levelName}. Finish half the lessons in a world to open the next one.</p>
      <ol className="mx-auto mt-8 max-w-2xl">
        {o.worlds.map((w, i) => {
          const prev = o.worlds[i - 1];
          const left = i % 2 === 0;
          const stars = w.lessons.reduce((s, l) => s + l.bestStars, 0);
          const needed = prev ? Math.max(0, prev.lessonsToUnlockNext - prev.completedCount) : 0;
          const card = (
            <div
              className={cn(
                'flex w-full max-w-sm items-center gap-4 rounded-[2rem] p-4 text-left transition-transform sm:p-5',
                w.unlocked ? 'bg-paper shadow-[0_5px_0_0_var(--color-line)] hover:-translate-y-0.5' : 'border-2 border-dashed border-line bg-chalk',
              )}
            >
              <WorldEmblem themeKey={w.themeKey} locked={!w.unlocked} className="h-20 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-extrabold">{w.title}</h2>
                {w.unlocked ? (
                  <>
                    <p className="text-sm text-ink-soft">
                      {w.completedCount} of {w.lessonCount} lessons
                    </p>
                    <Meter className="mt-2" value={w.completedCount} max={w.lessonCount} label={`${w.title}: ${w.completedCount} of ${w.lessonCount} lessons completed`} />
                    <p className="mt-1.5 flex items-center gap-1 text-sm font-bold text-sun-dark tabular">
                      <StarIcon filled className="h-4 w-4" /> {stars} of {w.lessonCount * 3}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-ink-soft">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {prev && prev.unlocked
                      ? `Finish ${needed} more ${needed === 1 ? 'lesson' : 'lessons'} in ${prev.title} to open.`
                      : 'Opens after the worlds before it.'}
                  </p>
                )}
              </div>
            </div>
          );
          return (
            <li key={w.id}>
              {i > 0 && (
                <svg viewBox="0 0 400 70" className="h-14 w-full" aria-hidden="true" preserveAspectRatio="none">
                  <path
                    d={left ? 'M300 0 C300 40 100 30 100 70' : 'M100 0 C100 40 300 30 300 70'}
                    fill="none"
                    stroke={w.unlocked ? 'var(--color-lagoon)' : 'var(--color-line)'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="2 12"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              <div className={cn('flex', left ? 'justify-start' : 'justify-end')}>
                {w.unlocked ? (
                  <Link href={`/learn/world/${w.id}`} className="block w-full max-w-sm rounded-[2rem]">
                    {card}
                  </Link>
                ) : (
                  <div aria-disabled="true" className="w-full max-w-sm">
                    {card}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
