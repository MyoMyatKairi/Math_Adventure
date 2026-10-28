import { useRouter } from 'expo-router';
import { LessonPlayer } from '../../src/components/lesson-player';
import { Button, EmptyState, ErrorState, Loading, Screen } from '../../src/components/ui';
import { useT } from '../../src/lib/i18n';
import { useLearner } from '../../src/lib/use-learner';

/** A practice round: earlier mistakes first, topped up from finished lessons. */
export default function PracticeScreen() {
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  const t = useT();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? t('common.couldNotLoad')} onRetry={reload} /></Screen>;
  if (!o.practice.available) {
    return (
      <Screen scroll={false}>
        <EmptyState title={t('practice.title')} body={t('practice.locked')} action={<Button label={t('practice.backHome')} onPress={() => router.replace('/learn')} />} />
      </Screen>
    );
  }
  return (
    <Screen>
      <LessonPlayer
        mode="review"
        childId={o.child.id}
        ageGroup={o.child.ageGroup}
        isDaily={false}
        mistakes={o.practice.mistakes}
        onExit={() => router.replace('/learn')}
      />
    </Screen>
  );
}
