import { LOCALE_TAGS, type DailyGoalInfo, type StreakInfo } from '@math-adventure/shared';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLocale } from '../lib/i18n';
import { colors } from '../theme';
import { Card } from './ui';

const FLAME = 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

export function FlameIcon({ size = 22, lit = true, color }: { size?: number; lit?: boolean; color?: string }) {
  const c = color ?? (lit ? colors.ember : colors.inkSoft);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME} fill={lit ? c : 'none'} stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

/** Small header pill: flame lit once today's streak day is done. */
export function StreakChip({ streak }: { streak: StreakInfo }) {
  const { t } = useLocale();
  return (
    <View
      accessible
      accessibilityLabel={t('streak.label', { count: streak.current })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: streak.practicedToday ? colors.emberSoft : 'rgba(255,255,255,0.6)' }}
    >
      <FlameIcon size={18} lit={streak.practicedToday} />
      <Text style={{ fontWeight: '900', fontSize: 16, color: streak.practicedToday ? colors.emberDark : colors.inkSoft }}>{streak.current}</Text>
    </View>
  );
}

/** Streak with this week's days and the daily goal ring. */
export function StreakCard({ streak, goal }: { streak: StreakInfo; goal: DailyGoalInfo }) {
  const { t, locale } = useLocale();
  const weekday = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: 'narrow', timeZone: 'UTC' });
  const met = goal.done >= goal.target;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FlameIcon size={26} lit={streak.practicedToday} />
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{t('streak.label', { count: streak.current })}</Text>
          </View>
          <Text style={{ color: colors.inkSoft }}>
            {t(streak.practicedToday ? 'streak.doneToday' : streak.current > 0 ? 'streak.keepGoing' : 'streak.start')}
          </Text>
        </View>
        <GoalRing goal={goal} />
      </View>
      <View accessible accessibilityLabel={t('streak.week')} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {streak.week.map((d, i) => {
          const today = i === streak.week.length - 1;
          return (
            <View
              key={d.date}
              accessible
              accessibilityLabel={t(d.active ? 'streak.dayActive' : 'streak.dayMissed', { day: weekday.format(new Date(d.date)) })}
              style={{ alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: today ? colors.ink : colors.inkSoft }}>{weekday.format(new Date(d.date))}</Text>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: d.active ? colors.ember : colors.chalk,
                  borderWidth: today && !d.active ? 2 : 0,
                  borderColor: colors.ember,
                }}
              >
                {d.active ? <FlameIcon size={16} color="#fff" /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ color: colors.inkSoft, fontWeight: '700' }}>
        {`❄ ${t('streak.freezes', { count: streak.freezes })}`}
      </Text>
      <Text style={{ color: met ? colors.lagoonDark : colors.inkSoft, fontWeight: '700' }}>
        {t(met ? 'goal.done' : 'goal.progress', { done: goal.done, target: goal.target })}
      </Text>
    </Card>
  );
}

export function GoalRing({ goal, size = 60 }: { goal: DailyGoalInfo; size?: number }) {
  const { t } = useLocale();
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = goal.target > 0 ? Math.min(1, goal.done / goal.target) : 0;
  const shown = Math.min(goal.done, goal.target);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('goal.meter')}
      accessibilityValue={{ min: 0, max: goal.target, now: shown, text: t('goal.progress', { done: shown, target: goal.target }) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={32} cy={32} r={r} fill="none" stroke={colors.line} strokeWidth={7} />
        <Circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={p >= 1 ? colors.lagoon : colors.sun}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - p)}
        />
      </Svg>
      <Text style={{ fontWeight: '900', color: p >= 1 ? colors.lagoonDark : colors.ink }}>{p >= 1 ? '✓' : `${goal.done}/${goal.target}`}</Text>
    </View>
  );
}
