import type { Metadata } from 'next';
import Link from 'next/link';
import { startLearningAction } from '@/app/actions/children';
import { Avatar } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { friendlyError } from '@/lib/errors';
import { requireParentArea } from '@/lib/parent-area';
import { createClient } from '@/lib/supabase/server';
import type { ParentChildSummary } from '@/lib/types';
import { relativeDay } from '@/lib/utils';

export const metadata: Metadata = { title: 'Parent dashboard' };

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; added?: string; removed?: string; password?: string }>;
}) {
  const user = await requireParentArea('/parent');
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_parent_overview');
  const children = (data ?? []) as ParentChildSummary[];
  const name = (user.user_metadata?.display_name as string | undefined) ?? '';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{name ? `Hi, ${name}` : 'Your family'}</h1>
          <p className="text-ink-soft">See how each learner is getting on, or hand the device over for a lesson.</p>
        </div>
        {children.length > 0 && children.length < 8 && (
          <Button asChild variant="secondary">
            <Link href="/parent/children/new">Add learner</Link>
          </Button>
        )}
      </div>

      {params.added && <FormMessage tone="success">{params.added} is ready to start learning.</FormMessage>}
      {params.removed && <FormMessage tone="success">{params.removed}&apos;s profile was deleted.</FormMessage>}
      {params.password && <FormMessage tone="success">Your password was updated.</FormMessage>}
      {error && <FormMessage>{friendlyError(error)}</FormMessage>}

      {children.length === 0 && !error ? (
        <EmptyState
          title={params.welcome ? 'Welcome! Add your first learner' : 'Add your first learner'}
          action={
            <Button asChild size="lg">
              <Link href="/parent/children/new">Add learner</Link>
            </Button>
          }
        >
          Give them a nickname, an avatar and a starting level. It takes under a minute.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id} className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
              <div className="flex items-center gap-3">
                <Avatar avatarKey={c.avatarKey} className="h-14 w-14" />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-extrabold">{c.displayName}</h2>
                  <p className="text-sm text-ink-soft">
                    {c.levelName}, ages {c.ageGroup.replace('-', '–')}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Lessons" value={c.stats.lessonsCompleted} />
                <Stat label="Stars" value={c.stats.totalStars} />
                <Stat label="XP" value={c.stats.totalXp} />
              </dl>
              <p className="mt-3 text-sm text-ink-soft">
                {c.lastActiveAt ? `Last practised: ${relativeDay(c.lastActiveAt)}` : 'Hasn’t started a lesson yet.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={startLearningAction.bind(null, c.id)}>
                  <Button type="submit">Start learning</Button>
                </form>
                <Button asChild variant="secondary">
                  <Link href={`/parent/children/${c.id}`}>View progress</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-chalk py-2">
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-extrabold tabular">{value}</dd>
    </div>
  );
}
