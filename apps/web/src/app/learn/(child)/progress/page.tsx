import type { Metadata } from 'next';
import Link from 'next/link';
import { WorldEmblem } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { Stars } from '@/components/ui/stars';
import { requireLearner } from '@/lib/learner';

export const metadata: Metadata = { title: 'My progress' };

export default async function ProgressPage() {
  const o = await requireLearner();
  const all = o.worlds.flatMap((w) => w.lessons);
  const done = all.filter((l) => l.status === 'completed').length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">My progress</h1>
      <div className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
        <p className="font-semibold">
          {done} of {all.length} lessons finished in {o.child.levelName}
        </p>
        <Meter className="mt-2" value={done} max={all.length} label={`${done} of ${all.length} lessons finished`} />
      </div>
      {o.worlds.map((w) => (
        <section key={w.id} aria-labelledby={`w-${w.id}`} className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <div className="flex items-center gap-3">
            <WorldEmblem themeKey={w.themeKey} locked={!w.unlocked} className="h-12 w-12" />
            <h2 id={`w-${w.id}`} className="font-display text-xl font-extrabold">
              {w.title}
            </h2>
            {!w.unlocked && <span className="text-sm font-semibold text-ink-soft">Locked</span>}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {w.lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                {w.unlocked ? (
                  <Link href={`/learn/lesson/${l.id}`} className="font-semibold underline-offset-4 hover:underline">
                    {l.title}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink-soft">{l.title}</span>
                )}
                {l.status === 'completed' ? (
                  <span className="flex items-center gap-2 text-sm text-ink-soft tabular">
                    Best {l.bestScore}% <Stars count={l.bestStars} size="h-4 w-4" />
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">{l.status === 'in_progress' ? 'In progress' : 'Not started'}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
