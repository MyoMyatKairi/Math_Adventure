import { xpLevel } from '@math-adventure/shared';
import { Text, View } from 'react-native';
import { Body, Card, ErrorState, H1, H2, Loading, Meter, Screen } from '../../src/components/ui';
import { useT } from '../../src/lib/i18n';
import { useLearner } from '../../src/lib/use-learner';
import { colors } from '../../src/theme';

export default function Rewards() {
  const { data: o, error, loading, reload } = useLearner();
  const t = useT();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? t('common.couldNotLoad')} onRetry={reload} /></Screen>;
  const lvl = xpLevel(o.stats.totalXp);
  return (
    <Screen>
      <H1>{t('rewards.title')}</H1>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card tone="sun" style={{ flex: 1 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.sunDark }}>{o.stats.totalStars}</Text>
          <Body>{t('rewards.stars')}</Body>
        </Card>
        <Card tone="plum" style={{ flex: 1 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.plumDark }}>{t('rewards.levelShort', { level: lvl.level })}</Text>
          <Meter value={lvl.intoLevel} max={lvl.levelSize} label={t('home.xpMeter')} color={colors.plum} />
        </Card>
      </View>
      <H2>{t('rewards.badges')}</H2>
      {o.badges.map((b) => (
        <Card key={b.key} tone={b.awardedAt ? 'paper' : 'sky'}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: b.awardedAt ? colors.ink : colors.inkSoft }}>{`${b.awardedAt ? '★ ' : ''}${b.title}`}</Text>
          <Body muted>{b.awardedAt ? b.description : t('rewards.notYetBadge', { description: b.description })}</Body>
        </Card>
      ))}
    </Screen>
  );
}
