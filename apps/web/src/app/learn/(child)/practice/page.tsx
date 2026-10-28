import type { Metadata } from 'next';
import Link from 'next/link';
import { LessonPlayer } from '@/components/learn/lesson-player';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getT } from '@/lib/i18n';
import { requireLearner } from '@/lib/learner';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('practice.meta') };
}

/** A practice round: earlier mistakes first, topped up from finished lessons. */
export default async function PracticePage() {
  const o = await requireLearner();
  const t = await getT();

  if (!o.practice.available) {
    return (
      <EmptyState
        title={t('practice.title')}
        action={
          <Button asChild>
            <Link href="/learn/home">{t('practice.backHome')}</Link>
          </Button>
        }
      >
        {t('practice.locked')}
      </EmptyState>
    );
  }

  return (
    <LessonPlayer
      mode="review"
      childId={o.child.id}
      ageGroup={o.child.ageGroup}
      lesson={null}
      sections={[]}
      isDaily={false}
      nextLesson={null}
      mistakes={o.practice.mistakes}
    />
  );
}
