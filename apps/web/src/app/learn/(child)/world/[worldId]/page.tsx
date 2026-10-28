import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock } from 'lucide-react';
import { WorldEmblem } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Stars } from '@/components/ui/stars';
import { getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';
import type { MapLessonInfo } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('world.meta') };
}

export default async function WorldPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const o = await requireLearner();
  const t = await getT();
  const world = o.worlds.find((w) => w.id === worldId);
  if (!world) notFound();

  if (!world.unlocked) {
    return (
      <EmptyState
        title={t('world.locked', { world: world.title })}
        action={
          <Button asChild>
            <Link href="/learn/map">{t('world.back')}</Link>
          </Button>
        }
      >
        {t('world.lockedBody')}
      </EmptyState>
    );
  }

  const topics = new Map<string, MapLessonInfo[]>();
  for (const l of world.lessons) topics.set(l.topicTitle, [...(topics.get(l.topicTitle) ?? []), l]);

  return (
    <div className="space-y-8">
      <Link href="/learn/map" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
        {t('world.back')}
      </Link>
      <header className="flex items-center gap-4">
        <WorldEmblem themeKey={world.themeKey} className="h-24 w-24" />
        <div>
          <h1 className="font-display text-3xl font-extrabold">{world.title}</h1>
          <p className="text-ink-soft">{world.description}</p>
        </div>
      </header>
      {[...topics.entries()].map(([topic, lessons]) => (
        <section key={topic} aria-labelledby={`t-${topic}`}>
          <h2 id={`t-${topic}`} className="font-display text-xl font-extrabold">
            {topic}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/learn/lesson/${l.id}`}
                  className="flex h-full flex-col rounded-3xl bg-paper p-4 shadow-[0_4px_0_0_var(--color-line)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="font-display text-lg font-bold leading-snug">{l.title}</span>
                  <span className="mt-1 flex-1 text-sm text-ink-soft">{l.description}</span>
                  <span className="mt-3 flex items-center justify-between text-sm">
                    {l.status === 'completed' ? (
                      <Stars count={l.bestStars} />
                    ) : l.status === 'in_progress' ? (
                      <span className="rounded-full bg-plum-soft px-2 py-0.5 font-bold text-plum-dark">{t('status.inProgress')}</span>
                    ) : (
                      <span className="rounded-full bg-lagoon-soft px-2 py-0.5 font-bold text-lagoon-dark">{t('status.new')}</span>
                    )}
                    <span className="flex items-center gap-1 text-ink-soft">
                      <Clock className="h-4 w-4" aria-hidden="true" /> {t('common.minutes', { count: l.estimatedMinutes })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
