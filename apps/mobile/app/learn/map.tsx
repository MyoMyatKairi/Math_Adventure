import { recommendLesson, type MapLessonInfo } from '@math-adventure/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from 'react-native';
import { Glass } from '../../src/components/glass';
import { Body, ErrorState, H1, Loading, Meter, Screen, StarRow } from '../../src/components/ui';
import { useT } from '../../src/lib/i18n';
import { useLearner } from '../../src/lib/use-learner';
import { colors } from '../../src/theme';

/** Sideways offset of each lesson node, in points, so the path winds. */
const WIND = [0, 56, 88, 56, 0, -56, -88, -56];
const NODE = 72;

/** Adventure map: one winding path of lessons, with a banner for each world. */
export default function MapScreen() {
  const router = useRouter();
  const { data: o, error, loading, reload } = useLearner();
  const t = useT();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? t('common.couldNotLoad')} onRetry={reload} /></Screen>;

  const current = recommendLesson(o.worlds, o.worlds.flatMap((w) => w.lessons.map((l) => ({ ...l, worldId: w.id }))));
  let step = 0;

  return (
    <Screen>
      <H1>{t('map.title')}</H1>
      <Body muted>{t('map.leadShort')}</Body>
      {o.worlds.map((w, i) => {
        const prev = o.worlds[i - 1];
        const needed = prev ? Math.max(0, prev.lessonsToUnlockNext - prev.completedCount) : 0;
        return (
          <View key={w.id} style={{ gap: 20, marginBottom: 12 }}>
            <Glass tint={w.unlocked ? colors.ink : undefined} variant={w.unlocked ? 'regular' : 'clear'} style={{ borderRadius: 28, padding: 16, gap: 6 }}>
              <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '900', color: w.unlocked ? '#fff' : colors.ink }}>
                {w.title}
              </Text>
              {w.unlocked ? (
                <>
                  <Meter value={w.completedCount} max={w.lessonCount} color={colors.sun} label={t('map.meterLabel', { world: w.title, done: w.completedCount, total: w.lessonCount })} />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>{t('map.lessonsOf', { done: w.completedCount, total: w.lessonCount })}</Text>
                </>
              ) : (
                <Body muted>{prev?.unlocked ? t('map.lockedFinishMore', { count: needed, world: prev.title }) : t('map.lockedLater')}</Body>
              )}
            </Glass>
            <View style={{ alignItems: 'center', gap: 18 }}>
              {w.lessons.map((l) => (
                <View key={l.id} style={{ transform: [{ translateX: WIND[step++ % WIND.length]! }] }}>
                  <PathNode lesson={l} unlocked={w.unlocked} current={current?.id === l.id} onPress={() => router.push(`/learn/lesson/${l.id}`)} />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

function PathNode({ lesson: l, unlocked, current, onPress }: { lesson: MapLessonInfo; unlocked: boolean; current: boolean; onPress: () => void }) {
  const t = useT();
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!current || !unlocked) return;
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => loop?.stop();
  }, [current, unlocked, hop]);

  const done = l.status === 'completed';
  const perfect = done && l.bestStars === 3;
  const look = !unlocked
    ? { tint: undefined, fg: colors.inkSoft }
    : perfect
      ? { tint: colors.sun, fg: colors.sunDark }
      : done || current
        ? { tint: colors.lagoon, fg: '#fff' }
        : { tint: undefined, fg: colors.ink };
  const status = !unlocked
    ? t('status.locked')
    : done
      ? t('status.stars', { count: l.bestStars })
      : t(l.status === 'in_progress' ? 'status.inProgress' : 'status.new').toLowerCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.lessonA11y', { title: l.title, status })}
      accessibilityState={{ disabled: !unlocked, selected: current }}
      disabled={!unlocked}
      onPress={onPress}
      style={{ alignItems: 'center', width: 140 }}
    >
      {({ pressed }) => (
        <>
          {current && unlocked ? (
            <Animated.View style={{ marginBottom: 6, transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
              <Glass style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ fontWeight: '900', color: colors.lagoonDark, letterSpacing: 1 }}>{t('map.start').toUpperCase()}</Text>
              </Glass>
            </Animated.View>
          ) : null}
          <View style={{ transform: [{ scale: pressed ? 0.94 : 1 }], opacity: unlocked ? 1 : 0.7 }}>
            <Glass
              tint={look.tint}
              interactive={unlocked}
              variant={unlocked ? 'regular' : 'clear'}
              style={{ width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 26, fontWeight: '900', color: look.fg }}>{!unlocked ? '🔒' : perfect ? '★' : done ? '✓' : String(l.displayOrder)}</Text>
            </Glass>
          </View>
          <Text numberOfLines={2} style={{ marginTop: 6, textAlign: 'center', fontWeight: '800', color: colors.ink }}>
            {l.title}
          </Text>
          {unlocked && done ? <StarRow count={l.bestStars} size={14} /> : null}
        </>
      )}
    </Pressable>
  );
}
