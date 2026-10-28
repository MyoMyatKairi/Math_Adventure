import { levelName, recommendLesson, xpLevel } from '@math-adventure/shared';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { StreakCard, StreakChip } from '../../src/components/streak';
import { AvatarBadge, Body, Button, Card, ErrorState, H1, H2, LanguageSwitcher, Loading, Meter, Screen } from '../../src/components/ui';
import { useT } from '../../src/lib/i18n';
import { useLearner } from '../../src/lib/use-learner';
import { colors } from '../../src/theme';

export default function LearnerHome() {
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  const t = useT();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? t('common.couldNotLoad')} onRetry={reload} /></Screen>;

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
          <Body muted>{t('home.levelLine', { level: levelName(o.child.learningLevelId, t, o.child.levelName), xpLevel: lvl.level })}</Body>
        </View>
        <StreakChip streak={o.streak} />
        <Button label={t('nav.switch')} variant="ghost" onPress={() => router.replace('/profiles')} />
      </View>
      <Card tone="ink">
        <H1 color="#fff">{t(isNew ? 'home.startsHere' : 'home.ready')}</H1>
        {nextInfo ? (
          <>
            <Text style={{ color: '#fff', fontSize: 17 }}>{t('home.nextShort', { lesson: nextInfo.title, minutes: nextInfo.estimatedMinutes })}</Text>
            <Button label={t(isNew ? 'home.startFirst' : nextInfo.status === 'in_progress' ? 'home.continue' : 'home.start')} variant="sun" size="lg" onPress={() => router.push(`/learn/lesson/${nextInfo.id}`)} />
          </>
        ) : (
          <Text style={{ color: '#fff' }}>{t('home.noLessonsShort')}</Text>
        )}
      </Card>
      <StreakCard streak={o.streak} goal={o.dailyGoal} />
      <Card tone="plum">
        <H2>{t('practice.title')}</H2>
        <Body>{!o.practice.available ? t('practice.locked') : o.practice.mistakes > 0 ? t('practice.mistakes', { count: o.practice.mistakes }) : t('practice.warmUp')}</Body>
        {o.practice.available ? <Button label={t('practice.start')} onPress={() => router.push('/learn/practice')} /> : null}
      </Card>
      {o.daily ? (
        <Card tone="sun">
          <H2>{t('home.daily')}</H2>
          {o.daily.completed ? (
            <Body>{t('home.dailyDone')}</Body>
          ) : (
            <>
              <Body>{t('home.dailyText', { lesson: o.daily.title, xp: o.daily.bonusXp })}</Body>
              <Button label={t('home.dailyPlay')} variant="sun" onPress={() => router.push(`/learn/lesson/${o.daily!.lessonId}?daily=1`)} />
            </>
          )}
        </Card>
      ) : null}
      <Card>
        <H2>{t('home.explorerLevel', { level: lvl.level })}</H2>
        <Body muted>{t('home.xpToNext', { into: lvl.intoLevel, size: lvl.levelSize, next: lvl.level + 1 })}</Body>
        <Meter value={lvl.intoLevel} max={lvl.levelSize} label={t('home.xpMeter')} color={colors.plum} />
        <Body>{t('common.statsLine', { lessons: o.stats.lessonsCompleted, stars: o.stats.totalStars, xp: o.stats.totalXp })}</Body>
      </Card>
      <LanguageSwitcher />
      <Button label={t('nav.grownUps')} variant="ghost" onPress={() => router.push('/parent-gate')} />
    </Screen>
  );
}
