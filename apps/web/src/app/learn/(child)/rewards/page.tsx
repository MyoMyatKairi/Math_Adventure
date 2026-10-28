import { xpLevel } from '@math-adventure/shared';
import type { Metadata } from 'next';
import { BadgeMedal } from '@/components/brand/icons';
import { Meter } from '@/components/ui/meter';
import { StarIcon } from '@/components/ui/stars';
import { getLocale, getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';
import { formatDate } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('rewards.meta') };
}

export default async function RewardsPage() {
  const o = await requireLearner();
  const t = await getT();
  const locale = await getLocale();
  const lvl = xpLevel(o.stats.totalXp);
  const earned = o.badges.filter((b) => b.awardedAt).length;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">{t('rewards.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-3xl bg-sun-soft p-5">
          <StarIcon filled className="h-14 w-14" />
          <div>
            <p className="font-display text-4xl font-extrabold tabular">{o.stats.totalStars}</p>
            <p className="font-semibold text-sun-dark">{t('rewards.starsCollected')}</p>
          </div>
        </div>
        <div className="rounded-3xl bg-plum-soft p-5">
          <p className="font-display text-2xl font-extrabold">{t('home.explorerLevel', { level: lvl.level })}</p>
          <p className="text-sm font-semibold text-plum-dark tabular">{t('rewards.totalXp', { xp: o.stats.totalXp })}</p>
          <Meter className="mt-3" value={lvl.intoLevel} max={lvl.levelSize} tone="plum" label={t('home.xpMeter')} />
        </div>
      </div>
      <section aria-labelledby="badges">
        <h2 id="badges" className="font-display text-xl font-extrabold">
          {t('rewards.badges')} <span className="text-ink-soft tabular">{t('rewards.badgesCount', { earned, total: o.badges.length })}</span>
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {o.badges.map((b) => (
            <li key={b.key} className={`flex flex-col items-center rounded-3xl p-4 text-center ${b.awardedAt ? 'bg-paper shadow-[0_4px_0_0_var(--color-line)]' : 'bg-chalk'}`}>
              <BadgeMedal iconKey={b.iconKey} earned={Boolean(b.awardedAt)} />
              <p className="mt-2 font-display font-bold">{b.title}</p>
              <p className="text-sm text-ink-soft">{b.description}</p>
              <p className="mt-1 text-xs font-semibold text-ink-soft">{b.awardedAt ? t('rewards.earned', { date: formatDate(b.awardedAt, locale) }) : t('rewards.notYet')}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
