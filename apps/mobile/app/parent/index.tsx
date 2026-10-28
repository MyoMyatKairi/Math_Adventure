import { ageRange, levelName, type ParentChildSummary } from '@math-adventure/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { AvatarBadge, Body, Button, Card, EmptyState, ErrorState, H1, LanguageSwitcher, Loading, Screen } from '../../src/components/ui';
import { useT } from '../../src/lib/i18n';
import { useSession } from '../../src/lib/session';
import { useRpc } from '../../src/lib/use-rpc';
import { colors } from '../../src/theme';

export default function ParentHome() {
  const router = useRouter();
  const { signOut, setActiveChild, lockParent } = useSession();
  const t = useT();
  const { data, error, loading, reload } = useRpc<ParentChildSummary[]>('get_parent_overview', {});
  useFocusEffect(useCallback(() => void reload(), [reload]));

  return (
    <Screen>
      <LanguageSwitcher />
      <H1>{t('parent.family')}</H1>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && data.length === 0 ? (
        <EmptyState title={t('parent.emptyTitle')} body={t('parent.emptyBody')} action={<Button label={t('parent.addLearner')} onPress={() => router.push('/parent/new-child')} />} />
      ) : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AvatarBadge avatarKey={c.avatarKey} name={c.displayName} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{c.displayName}</Text>
              <Body muted>{t('common.levelAges', { level: levelName(c.learningLevelId, t, c.levelName), range: ageRange(c.ageGroup) })}</Body>
            </View>
          </View>
          <Body>{t('common.statsLine', { lessons: c.stats.lessonsCompleted, stars: c.stats.totalStars, xp: c.stats.totalXp })}</Body>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label={t('parent.startLearning')}
              onPress={async () => {
                await setActiveChild(c.id);
                lockParent();
                router.replace('/learn');
              }}
            />
            <Button label={t('parent.viewProgress')} variant="secondary" onPress={() => router.push(`/parent/child/${c.id}`)} />
          </View>
        </Card>
      ))}
      {data && data.length > 0 && data.length < 8 ? <Button label={t('parent.addLearner')} variant="secondary" onPress={() => router.push('/parent/new-child')} /> : null}
      <Button label={t('parent.learnerMode')} variant="ghost" onPress={() => router.replace('/profiles')} />
      <Button
        label={t('parent.signOut')}
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}
