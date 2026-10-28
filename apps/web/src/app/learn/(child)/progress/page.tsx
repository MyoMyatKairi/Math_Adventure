import type { Metadata } from 'next';
import Link from 'next/link';
import { WorldEmblem } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { Stars } from '@/components/ui/stars';
import { levelName } from '@math-adventure/shared';
import { getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('progress.meta') };
}

export default async function ProgressPage() {
  const o = await requireLearner();
  const t = await getT();
  const all = o.worlds.flatMap((w) => w.lessons);
  const done = all.filter((l) => l.status === 'completed').length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">{t('progress.title')}</h1>
      <div className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
        <p className="font-semibold">{t('progress.summary', { done, total: all.length, level: levelName(o.child.learningLevelId, t, o.child.levelName) })}</p>
        <Meter className="mt-2" value={done} max={all.length} label={t('progress.meter', { done, total: all.length })} />
      </div>
      {o.worlds.map((w) => (
        <section key={w.id} aria-labelledby={`w-${w.id}`} className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
          <div className="flex items-center gap-3">
            <WorldEmblem themeKey={w.themeKey} locked={!w.unlocked} className="h-12 w-12" />
            <h2 id={`w-${w.id}`} className="font-display text-xl font-extrabold">
              {w.title}
            </h2>
            {!w.unlocked && <span className="text-sm font-semibold text-ink-soft">{t('status.locked')}</span>}
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
                    {t('progress.best', { score: l.bestScore })} <Stars count={l.bestStars} size="h-4 w-4" />
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">{t(l.status === 'in_progress' ? 'status.inProgress' : 'status.notStarted')}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
