import type { ParentChildSummary } from '@math-adventure/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { AvatarBadge, Body, Button, Card, EmptyState, ErrorState, H1, Loading, Screen } from '../../src/components/ui';
import { useSession } from '../../src/lib/session';
import { useRpc } from '../../src/lib/use-rpc';
import { colors } from '../../src/theme';

export default function ParentHome() {
  const router = useRouter();
  const { signOut, setActiveChild, lockParent } = useSession();
  const { data, error, loading, reload } = useRpc<ParentChildSummary[]>('get_parent_overview', {});
  useFocusEffect(useCallback(() => void reload(), [reload]));

  return (
    <Screen>
      <H1>Your family</H1>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="Add your first learner" body="A nickname, an avatar and a starting level. It takes under a minute." action={<Button label="Add learner" onPress={() => router.push('/parent/new-child')} />} />
      ) : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AvatarBadge avatarKey={c.avatarKey} name={c.displayName} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{c.displayName}</Text>
              <Body muted>{`${c.levelName}, ages ${c.ageGroup.replace('-', '–')}`}</Body>
            </View>
          </View>
          <Body>{`${c.stats.lessonsCompleted} lessons, ${c.stats.totalStars} stars, ${c.stats.totalXp} XP`}</Body>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label="Start learning"
              onPress={async () => {
                await setActiveChild(c.id);
                lockParent();
                router.replace('/learn');
              }}
            />
            <Button label="View progress" variant="secondary" onPress={() => router.push(`/parent/child/${c.id}`)} />
          </View>
        </Card>
      ))}
      {data && data.length > 0 && data.length < 8 ? <Button label="Add learner" variant="secondary" onPress={() => router.push('/parent/new-child')} /> : null}
      <Button label="Learner mode" variant="ghost" onPress={() => router.replace('/profiles')} />
      <Button
        label="Sign out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}
