import { ageRange, levelName } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { startLearningAction } from '@/app/actions/children';
import { Avatar } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { friendlyError } from '@/lib/errors';
import { getLocale, getT } from '@/lib/i18n';
import { requireParentArea } from '@/lib/parent-area';
import { createClient } from '@/lib/supabase/server';
import type { ParentChildSummary } from '@/lib/types';
import { relativeDay } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('parent.meta') };
}

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; added?: string; removed?: string; password?: string }>;
}) {
  const user = await requireParentArea('/parent');
  const params = await searchParams;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_parent_overview');
  const children = (data ?? []) as ParentChildSummary[];
  const name = (user.user_metadata?.display_name as string | undefined) ?? '';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{name ? t('parent.hi', { name }) : t('parent.family')}</h1>
          <p className="text-ink-soft">{t('parent.lead')}</p>
        </div>
        {children.length > 0 && children.length < 8 && (
          <Button asChild variant="secondary">
            <Link href="/parent/children/new">{t('parent.addLearner')}</Link>
          </Button>
        )}
      </div>

      {params.added && <FormMessage tone="success">{t('parent.added', { name: params.added })}</FormMessage>}
      {params.removed && <FormMessage tone="success">{t('parent.removed', { name: params.removed })}</FormMessage>}
      {params.password && <FormMessage tone="success">{t('parent.passwordUpdated')}</FormMessage>}
      {error && <FormMessage>{friendlyError(error, locale)}</FormMessage>}

      {children.length === 0 && !error ? (
        <EmptyState
          title={t(params.welcome ? 'parent.welcomeEmpty' : 'parent.emptyTitle')}
          action={
            <Button asChild size="lg">
              <Link href="/parent/children/new">{t('parent.addLearner')}</Link>
            </Button>
          }
        >
          {t('parent.emptyBody')}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id} className="rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
              <div className="flex items-center gap-3">
                <Avatar avatarKey={c.avatarKey} className="h-14 w-14" />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-extrabold">{c.displayName}</h2>
                  <p className="text-sm text-ink-soft">{t('common.levelAges', { level: levelName(c.learningLevelId, t, c.levelName), range: ageRange(c.ageGroup) })}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label={t('common.lessons')} value={c.stats.lessonsCompleted} />
                <Stat label={t('common.stars')} value={c.stats.totalStars} />
                <Stat label={t('common.xp')} value={c.stats.totalXp} />
              </dl>
              <p className="mt-3 text-sm text-ink-soft">
                {c.lastActiveAt ? t('parent.lastPractised', { when: relativeDay(c.lastActiveAt, t, locale) }) : t('parent.notStarted')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={startLearningAction.bind(null, c.id)}>
                  <Button type="submit">{t('parent.startLearning')}</Button>
                </form>
                <Button asChild variant="secondary">
                  <Link href={`/parent/children/${c.id}`}>{t('parent.viewProgress')}</Link>
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
