'use client';

import type { TopicSummary } from '@math-adventure/shared';
import { useLocale, useT } from '@/components/i18n';
import { cn, formatDate } from '@/lib/utils';

/**
 * Single-series column chart for the last 7 days. One hue (lagoon), rounded
 * data ends anchored to the baseline, value labels on non-zero days, a native
 * tooltip per column, and a visually hidden table for screen readers.
 */
export function WeeklyChart({ days }: { days: { date: string; lessonsCompleted: number; questionsAnswered: number }[] }) {
  const t = useT();
  const locale = useLocale();
  const max = Math.max(1, ...days.map((d) => d.lessonsCompleted));
  const total = days.reduce((s, d) => s + d.lessonsCompleted, 0);
  return (
    <figure>
      <figcaption className="sr-only">{t('charts.weekCaption')}</figcaption>
      <div className="flex h-40 items-end gap-2" aria-hidden="true">
        {days.map((d) => {
          const label = formatDate(`${d.date}T12:00:00Z`, locale, { weekday: 'short' });
          const h = d.lessonsCompleted === 0 ? 0 : Math.max(8, (d.lessonsCompleted / max) * 120);
          return (
            <div
              key={d.date}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={t('charts.dayTitle', { day: label, lessons: d.lessonsCompleted, questions: d.questionsAnswered })}
            >
              {d.lessonsCompleted > 0 && <span className="text-sm font-bold tabular text-ink">{d.lessonsCompleted}</span>}
              <div
                className="w-full max-w-10 rounded-t-[4px] bg-lagoon transition-opacity group-hover:opacity-80"
                style={{ height: `${h}px` }}
              />
              <div className="h-[2px] w-full bg-line" />
              <span className="text-xs font-semibold text-ink-soft">{label}</span>
            </div>
          );
        })}
      </div>
      {total === 0 && <p className="mt-2 text-sm text-ink-soft">{t('charts.noLessons')}</p>}
      <table className="sr-only">
        <thead>
          <tr>
            <th>{t('charts.day')}</th>
            <th>{t('charts.lessons')}</th>
            <th>{t('charts.questions')}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(`${d.date}T12:00:00Z`, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</td>
              <td>{d.lessonsCompleted}</td>
              <td>{d.questionsAnswered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const STATUS_CHIP: Record<TopicSummary['status'], string> = {
  not_started: 'bg-chalk text-ink-soft',
  needs_practice: 'bg-ember-soft text-ember-dark',
  growing: 'bg-sky-soft text-ink',
  confident: 'bg-lagoon-soft text-lagoon-dark',
};

/** Per-topic first-try accuracy as horizontal bars; status is always a word, never colour alone. */
export function TopicBars({ topics }: { topics: TopicSummary[] }) {
  const t = useT();
  return (
    <ul className="space-y-4">
      {topics.map((topic) => {
        return (
          <li key={topic.topicId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{topic.topicTitle}</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_CHIP[topic.status])}>{t(`charts.status.${topic.status}`)}</span>
            </div>
            <div
              className="mt-1.5 h-3 w-full rounded-full bg-line/60"
              role="img"
              aria-label={
                topic.accuracy === null
                  ? t('charts.noAnswersFor', { topic: topic.topicTitle })
                  : t('charts.accuracyFor', { topic: topic.topicTitle, accuracy: topic.accuracy })
              }
              title={topic.accuracy === null ? t('report.noAnswers') : t('charts.correctOf', { correct: topic.firstTryCorrect, answered: topic.questionsAnswered })}
            >
              {topic.accuracy !== null && <div className="h-full rounded-full bg-lagoon" style={{ width: `${Math.max(topic.accuracy, 2)}%` }} />}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {topic.message}{' '}
              {topic.accuracy !== null && (
                <span className="tabular">
                  {t('charts.topicLine', { accuracy: topic.accuracy, done: topic.lessonsCompleted, total: topic.lessonCount })}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
