import type { TopicSummary } from '@math-adventure/shared';
import { cn, formatDate } from '@/lib/utils';

/**
 * Single-series column chart for the last 7 days. One hue (lagoon), rounded
 * data ends anchored to the baseline, value labels on non-zero days, a native
 * tooltip per column, and a visually hidden table for screen readers.
 */
export function WeeklyChart({ days }: { days: { date: string; lessonsCompleted: number; questionsAnswered: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.lessonsCompleted));
  const total = days.reduce((s, d) => s + d.lessonsCompleted, 0);
  return (
    <figure>
      <figcaption className="sr-only">Lessons completed per day over the last 7 days</figcaption>
      <div className="flex h-40 items-end gap-2" aria-hidden="true">
        {days.map((d) => {
          const label = formatDate(`${d.date}T12:00:00Z`, { weekday: 'short' });
          const h = d.lessonsCompleted === 0 ? 0 : Math.max(8, (d.lessonsCompleted / max) * 120);
          return (
            <div
              key={d.date}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={`${label}: ${d.lessonsCompleted} lessons, ${d.questionsAnswered} questions`}
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
      {total === 0 && <p className="mt-2 text-sm text-ink-soft">No lessons finished in the last 7 days.</p>}
      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            <th>Lessons completed</th>
            <th>Questions answered</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(`${d.date}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</td>
              <td>{d.lessonsCompleted}</td>
              <td>{d.questionsAnswered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const STATUS_STYLE: Record<TopicSummary['status'], { chip: string; label: string }> = {
  not_started: { chip: 'bg-chalk text-ink-soft', label: 'Not started' },
  needs_practice: { chip: 'bg-ember-soft text-ember-dark', label: 'Practise again' },
  growing: { chip: 'bg-sky-soft text-ink', label: 'Growing' },
  confident: { chip: 'bg-lagoon-soft text-lagoon-dark', label: 'Confident' },
};

/** Per-topic first-try accuracy as horizontal bars; status is always a word, never colour alone. */
export function TopicBars({ topics }: { topics: TopicSummary[] }) {
  return (
    <ul className="space-y-4">
      {topics.map((t) => {
        const style = STATUS_STYLE[t.status];
        return (
          <li key={t.topicId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{t.topicTitle}</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', style.chip)}>{style.label}</span>
            </div>
            <div
              className="mt-1.5 h-3 w-full rounded-full bg-line/60"
              role="img"
              aria-label={t.accuracy === null ? `${t.topicTitle}: no answers yet` : `${t.topicTitle}: ${t.accuracy}% correct first time`}
              title={t.accuracy === null ? 'No answers yet' : `${t.firstTryCorrect} of ${t.questionsAnswered} correct first time`}
            >
              {t.accuracy !== null && <div className="h-full rounded-full bg-lagoon" style={{ width: `${Math.max(t.accuracy, 2)}%` }} />}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {t.message}{' '}
              {t.accuracy !== null && (
                <span className="tabular">
                  {t.accuracy}% first time, {t.lessonsCompleted} of {t.lessonCount} lessons done.
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
