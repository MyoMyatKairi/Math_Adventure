import { recommendLesson, xpLevel } from '@math-adventure/shared';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AvatarBadge, Body, Button, Card, ErrorState, H1, H2, Loading, Meter, Screen } from '../../src/components/ui';
import { useLearner } from '../../src/lib/use-learner';
import { colors } from '../../src/theme';

export default function LearnerHome() {
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? 'Could not load'} onRetry={reload} /></Screen>;

  const lessons = o.worlds.flatMap((w) => w.lessons.map((l) => ({ ...l, worldId: w.id })));
  const next = recommendLesson(o.worlds, lessons);
  const nextInfo = next ? lessons.find((l) => l.id === next.id) : undefined;
  const lvl = xpLevel(o.stats.totalXp);
  const isNew = o.stats.lessonsCompleted === 0;

  return (
    <Screen testID="learner-home">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AvatarBadge avatarKey={o.child.avatarKey} name={o.child.displayName} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{o.child.displayName}</Text>
          <Body muted>{`${o.child.levelName}, explorer level ${lvl.level}`}</Body>
        </View>
        <Button label="Switch" variant="ghost" onPress={() => router.replace('/profiles')} />
      </View>
      <Card tone="ink">
        <H1 color="#fff">{isNew ? 'Your adventure starts here' : 'Ready for the next lesson?'}</H1>
        {nextInfo ? (
          <>
            <Text style={{ color: '#fff', fontSize: 17 }}>{`${nextInfo.title}. About ${nextInfo.estimatedMinutes} minutes.`}</Text>
            <Button label={isNew ? 'Start my first lesson' : nextInfo.status === 'in_progress' ? 'Continue lesson' : 'Start lesson'} variant="sun" size="lg" onPress={() => router.push(`/learn/lesson/${nextInfo.id}`)} />
          </>
        ) : (
          <Text style={{ color: '#fff' }}>No lessons in this level yet.</Text>
        )}
      </Card>
      {o.daily ? (
        <Card tone="sun">
          <H2>Today’s challenge</H2>
          {o.daily.completed ? (
            <Body>Done for today! A new challenge arrives tomorrow.</Body>
          ) : (
            <>
              <Body>{`${o.daily.title}. Finish it for ${o.daily.bonusXp} bonus XP.`}</Body>
              <Button label="Play today’s challenge" variant="sun" onPress={() => router.push(`/learn/lesson/${o.daily!.lessonId}?daily=1`)} />
            </>
          )}
        </Card>
      ) : null}
      <Card>
        <H2>{`Explorer level ${lvl.level}`}</H2>
        <Body muted>{`${lvl.intoLevel} of ${lvl.levelSize} XP to level ${lvl.level + 1}`}</Body>
        <Meter value={lvl.intoLevel} max={lvl.levelSize} label="Experience towards the next level" color={colors.plum} />
        <Body>{`${o.stats.lessonsCompleted} lessons, ${o.stats.totalStars} stars, ${o.stats.totalXp} XP`}</Body>
      </Card>
      <Button label="Grown-ups" variant="ghost" onPress={() => router.push('/parent-gate')} />
    </Screen>
  );
}
