import { xpLevel } from '@math-adventure/shared';
import type { Metadata } from 'next';
import { BadgeMedal } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { StarIcon } from '@/components/ui/stars';
import { requireLearner } from '@/lib/learner';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Rewards' };

export default async function RewardsPage() {
  const o = await requireLearner();
  const lvl = xpLevel(o.stats.totalXp);
  const earned = o.badges.filter((b) => b.awardedAt).length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Rewards</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-3xl bg-sun-soft p-5">
          <StarIcon filled className="h-14 w-14" />
          <div>
            <p className="font-display text-4xl font-extrabold tabular">{o.stats.totalStars}</p>
            <p className="font-semibold text-sun-dark">stars collected</p>
          </div>
        </div>
        <div className="rounded-3xl bg-plum-soft p-5">
          <p className="font-display text-2xl font-extrabold">Explorer level {lvl.level}</p>
          <p className="text-sm font-semibold text-plum-dark tabular">{o.stats.totalXp} XP in total</p>
          <Meter className="mt-3" value={lvl.intoLevel} max={lvl.levelSize} tone="plum" label="Experience towards the next level" />
        </div>
      </div>
      <section aria-labelledby="badges">
        <h2 id="badges" className="font-display text-xl font-extrabold">
          Badges <span className="text-ink-soft tabular">({earned} of {o.badges.length})</span>
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {o.badges.map((b) => (
            <li key={b.key} className={`flex flex-col items-center rounded-3xl p-4 text-center ${b.awardedAt ? 'bg-paper shadow-[0_4px_0_0_var(--color-line)]' : 'bg-chalk'}`}>
              <BadgeMedal iconKey={b.iconKey} earned={Boolean(b.awardedAt)} />
              <p className="mt-2 font-display font-bold">{b.title}</p>
              <p className="text-sm text-ink-soft">{b.description}</p>
              <p className="mt-1 text-xs font-semibold text-ink-soft">{b.awardedAt ? `Earned ${formatDate(b.awardedAt)}` : 'Not yet'}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
