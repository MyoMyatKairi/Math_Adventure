import { useLocalSearchParams, useRouter } from 'expo-router';
import { LessonPlayer } from '../../../src/components/lesson-player';
import { ErrorState, Loading, Screen } from '../../../src/components/ui';
import { useT } from '../../../src/lib/i18n';
import { useLearner } from '../../../src/lib/use-learner';

export default function LessonScreen() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  const t = useT();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? t('common.couldNotLoad')} onRetry={reload} /></Screen>;
  return (
    <Screen>
      <LessonPlayer
        key={id}
        childId={o.child.id}
        lessonId={id}
        ageGroup={o.child.ageGroup}
        isDaily={daily === '1' && o.daily?.lessonId === id}
        onExit={() => router.replace('/learn/map')}
      />
    </Screen>
  );
}
