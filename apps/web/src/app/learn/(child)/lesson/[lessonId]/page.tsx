import type { SectionContent } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LessonPlayer } from '@/components/learn/lesson-player';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireLearner } from '@/lib/learner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Lesson' };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ daily?: string }> }) {
  const { lessonId } = await params;
  const { daily } = await searchParams;
  const o = await requireLearner();

  const world = o.worlds.find((w) => w.lessons.some((l) => l.id === lessonId));
  const lesson = world?.lessons.find((l) => l.id === lessonId);
  if (!world || !lesson) notFound();

  if (!world.unlocked) {
    return (
      <EmptyState
        title="This lesson is still locked"
        action={
          <Button asChild>
            <Link href="/learn/map">Back to the map</Link>
          </Button>
        }
      >
        Finish more lessons in the world before {world.title} to open it.
      </EmptyState>
    );
  }

  const supabase = await createClient();
  const [{ data: sections }, { data: meta }] = await Promise.all([
    supabase.from('lesson_sections').select('section_type, title, content_json').eq('lesson_id', lessonId).order('display_order'),
    supabase.from('lessons').select('learning_objective').eq('id', lessonId).single(),
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
        objective: meta?.learning_objective ?? lesson.description,
        worldTitle: world.title,
        worldId: world.id,
        minutes: lesson.estimatedMinutes,
        status: lesson.status,
      }}
      sections={(sections ?? []).map((s) => ({ type: s.section_type, title: s.title, content: s.content_json as SectionContent }))}
      nextLesson={next ? { id: next.id, title: next.title } : null}
    />
  );
}
