import { overallAccuracy, summarizeTopics, topicsToPractise } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { startLearningAction } from '@/app/actions/children';
import { Avatar } from '@/components/brand/avatar';
import { TopicBars, WeeklyChart } from '@/components/parent/charts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { Meter } from '@/components/ui/meter';
import { Stars } from '@/components/ui/stars';
import { requireParentArea } from '@/lib/parent-area';
import { createClient } from '@/lib/supabase/server';
import type { ChildReport } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Learning progress' };

export default async function ChildReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  await requireParentArea(`/parent/children/${id}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_child_report', { p_child_id: id });
  if (error || !data) notFound();
  const report = data as ChildReport;
  const { child, stats } = report;

  const topics = summarizeTopics(report.topics);
  const practise = topicsToPractise(topics);
  const accuracy = overallAccuracy(report.topics);
  const confident = topics.filter((t) => t.status === 'confident');
  const hasActivity = report.recentActivity.length > 0;

  return (
    <div className="space-y-8">
      <Link href="/parent" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
        Back to dashboard
      </Link>
      {saved && <FormMessage tone="success">Changes saved.</FormMessage>}

      <header className="flex flex-wrap items-center gap-4">
        <Avatar avatarKey={child.avatarKey} className="h-16 w-16" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-extrabold">{child.displayName}</h1>
          <p className="text-ink-soft">
            {child.levelName}, ages {child.ageGroup.replace('-', '–')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={startLearningAction.bind(null, child.id)}>
            <Button type="submit">Start learning</Button>
          </form>
          <Button asChild variant="secondary">
            <Link href={`/parent/children/${child.id}/edit`}>Edit profile and level</Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="summary" className="grid gap-3 sm:grid-cols-4">
        <h2 id="summary" className="sr-only">
          Summary
        </h2>
        <Tile label="Lessons completed" value={`${stats.lessonsCompleted}`} sub={`of ${report.levelLessonCount} in ${child.levelName}`} />
        <Tile label="First-try accuracy" value={accuracy === null ? '—' : `${accuracy}%`} sub={accuracy === null ? 'No answers yet' : 'Across all answered questions'} />
        <Tile label="Stars" value={`${stats.totalStars}`} sub={`${stats.perfectLessons} perfect lessons`} />
        <Tile label="Experience" value={`${stats.totalXp} XP`} sub={`${stats.dailyChallenges} daily challenges`} />
      </section>

      {!hasActivity ? (
        <EmptyState
          title={`${child.displayName} hasn’t finished a lesson yet`}
          action={
            <form action={startLearningAction.bind(null, child.id)}>
              <Button type="submit" size="lg">
                Start the first lesson
              </Button>
            </form>
          }
        >
          Progress, accuracy and suggestions appear here after the first lesson.
        </EmptyState>
      ) : (
        <>
          {(practise.length > 0 || confident.length > 0) && (
            <section aria-labelledby="suggestions" className="rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
              <h2 id="suggestions" className="font-display text-xl font-bold">
                What to try next
              </h2>
              <ul className="mt-3 space-y-2">
                {practise.map((t) => (
                  <li key={t.topicId} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ember" />
                    <span>
                      <strong>{t.message}</strong> Replaying a lesson in this topic is a good next step.
                    </span>
                  </li>
                ))}
                {confident.map((t) => (
                  <li key={t.topicId} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lagoon" />
                    <span>{t.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="week" className="rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
              <h2 id="week" className="font-display text-xl font-bold">
                Lessons this week
              </h2>
              <p className="mb-4 text-sm text-ink-soft">Lessons finished each day (UTC).</p>
              <WeeklyChart days={report.weekly} />
            </section>

            <section aria-labelledby="recent" className="rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
              <h2 id="recent" className="font-display text-xl font-bold">
                Recent lessons
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {report.recentActivity.slice(0, 8).map((a) => (
                  <li key={a.attemptId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.lessonTitle}</p>
                      <p className="text-sm text-ink-soft">
                        {a.topicTitle}, {a.correctAnswers}/{a.totalQuestions} right first time
                        {a.isDailyChallenge ? ', daily challenge' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <Stars count={a.stars} />
                      <p className="text-xs text-ink-soft">{formatDate(a.completedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <section aria-labelledby="topics" className="rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
        <h2 id="topics" className="font-display text-xl font-bold">
          Progress by topic
        </h2>
        <p className="mb-5 text-sm text-ink-soft">Based on answers given on the first try.</p>
        <TopicBars topics={topics} />
        <div className="mt-6">
          <p className="mb-1 text-sm font-semibold">Level progress</p>
          <Meter value={stats.lessonsCompleted} max={report.levelLessonCount} label={`${stats.lessonsCompleted} of ${report.levelLessonCount} lessons completed`} />
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-paper p-4 shadow-[0_4px_0_0_var(--color-line)]">
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      <p className="font-display text-3xl font-extrabold tabular">{value}</p>
      <p className="text-xs text-ink-soft">{sub}</p>
    </div>
  );
}
