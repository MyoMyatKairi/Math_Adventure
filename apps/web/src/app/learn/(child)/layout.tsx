import { xpLevel } from '@math-adventure/shared';
import { Avatar } from '@/components/brand/avatar';
import { LearnerMenuLinks, LearnerNav } from '@/components/learn/learner-nav';
import { StarIcon } from '@/components/ui/stars';
import { requireLearner } from '@/lib/learner';

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const { child, stats } = await requireLearner();
  const lvl = xpLevel(stats.totalXp);
  return (
    <div className="min-h-dvh pb-24 sm:pb-8">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Avatar avatarKey={child.avatarKey} className="h-12 w-12" />
          <div>
            <p className="font-display text-lg font-extrabold leading-tight">{child.displayName}</p>
            <p className="text-sm font-semibold text-ink-soft">
              {child.levelName}, explorer level {lvl.level}
            </p>
          </div>
          <div className="ml-2 flex items-center gap-1 rounded-full bg-sun-soft px-3 py-1 font-display font-extrabold tabular text-sun-dark" aria-label={`${stats.totalStars} stars`}>
            <StarIcon filled className="h-4 w-4" />
            {stats.totalStars}
          </div>
        </div>
        <LearnerMenuLinks />
      </header>
      <div className="mx-auto mt-3 max-w-5xl px-4 sm:px-6">
        <LearnerNav />
      </div>
      <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
