import { pickTranslation, type SectionContent } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LessonPlayer } from '@/components/learn/lesson-player';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getLocale, getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('lesson.meta') };
}

export default async function LessonPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ daily?: string }> }) {
  const { lessonId } = await params;
  const { daily } = await searchParams;
  const o = await requireLearner();
  const t = await getT();
  const locale = await getLocale();

  const world = o.worlds.find((w) => w.lessons.some((l) => l.id === lessonId));
  const lesson = world?.lessons.find((l) => l.id === lessonId);
  if (!world || !lesson) notFound();

  if (!world.unlocked) {
    return (
      <EmptyState
        title={t('lesson.locked')}
        action={
          <Button asChild>
            <Link href="/learn/map">{t('world.back')}</Link>
          </Button>
        }
      >
        {t('lesson.lockedBody', { world: world.title })}
      </EmptyState>
    );
  }

  const supabase = await createClient();
  const [{ data: sections }, { data: meta }] = await Promise.all([
    supabase.from('lesson_sections').select('section_type, title, content_json, translations').eq('lesson_id', lessonId).order('display_order'),
    supabase.from('lessons').select('learning_objective, translations').eq('id', lessonId).single(),
  ]);

  // Suggest the next unfinished lesson in this world (or the next open world).
  const ordered = o.worlds.filter((w) => w.unlocked).flatMap((w) => w.lessons);
  const here = ordered.findIndex((l) => l.id === lessonId);
  const next = ordered.slice(here + 1).find((l) => l.status !== 'completed') ?? null;
  const isDaily = daily === '1' && o.daily?.lessonId === lessonId;

  return (
    <LessonPlayer
      key={lessonId}
      childId={o.child.id}
      ageGroup={o.child.ageGroup}
      isDaily={isDaily}
      lesson={{
        id: lesson.id,
        title: lesson.title,
        objective: meta ? pickTranslation(meta.learning_objective, meta.translations, locale, 'learning_objective') : lesson.description,
        worldTitle: world.title,
        worldId: world.id,
        minutes: lesson.estimatedMinutes,
        status: lesson.status,
      }}
      sections={(sections ?? []).map((s) => ({
        type: s.section_type,
        title: pickTranslation(s.title, s.translations, locale, 'title'),
        content: pickTranslation(s.content_json as SectionContent, s.translations, locale, 'content'),
      }))}
      nextLesson={next ? { id: next.id, title: next.title } : null}
    />
  );
}
