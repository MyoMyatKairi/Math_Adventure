import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, ErrorState, H1, H2, Loading, Meter, Screen, StarRow } from '../../src/components/ui';
import { useLearner } from '../../src/lib/use-learner';
import { colors, radius } from '../../src/theme';

/** Adventure map with world and lesson selection in one scroll. */
export default function MapScreen() {
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? 'Could not load'} onRetry={reload} /></Screen>;

  return (
    <Screen>
      <H1>Adventure map</H1>
      <Body muted>Finish half the lessons in a world to open the next one.</Body>
      {o.worlds.map((w, i) => {
        const prev = o.worlds[i - 1];
        const needed = prev ? Math.max(0, prev.lessonsToUnlockNext - prev.completedCount) : 0;
        return (
          <Card key={w.id} tone={w.unlocked ? 'paper' : 'sky'}>
            <H2>{w.title}</H2>
            {w.unlocked ? (
              <>
                <Body muted>{`${w.completedCount} of ${w.lessonCount} lessons`}</Body>
                <Meter value={w.completedCount} max={w.lessonCount} label={`${w.title}: ${w.completedCount} of ${w.lessonCount} lessons`} />
                {w.lessons.map((l) => (
                  <Pressable
                    key={l.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.title}, ${l.status === 'completed' ? `${l.bestStars} stars` : l.status === 'in_progress' ? 'in progress' : 'new'}`}
                    onPress={() => router.push(`/learn/lesson/${l.id}`)}
                    style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md, backgroundColor: colors.chalk, gap: 8 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{l.title}</Text>
                      <Text style={{ color: colors.inkSoft }}>{l.topicTitle}</Text>
                    </View>
                    {l.status === 'completed' ? <StarRow count={l.bestStars} size={18} /> : <Text style={{ fontWeight: '800', color: l.status === 'in_progress' ? colors.plumDark : colors.lagoonDark }}>{l.status === 'in_progress' ? 'In progress' : 'New'}</Text>}
                  </Pressable>
                ))}
              </>
            ) : (
              <Body>{prev?.unlocked ? `Locked. Finish ${needed} more ${needed === 1 ? 'lesson' : 'lessons'} in ${prev.title} to open.` : 'Locked. Opens after the worlds before it.'}</Body>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
