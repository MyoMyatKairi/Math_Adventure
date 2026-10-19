import { xpLevel } from '@math-adventure/shared';
import { Text, View } from 'react-native';
import { Body, Card, ErrorState, H1, H2, Loading, Meter, Screen } from '../../src/components/ui';
import { useLearner } from '../../src/lib/use-learner';
import { colors } from '../../src/theme';

export default function Rewards() {
  const { data: o, error, loading, reload } = useLearner();
  if (loading && !o) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !o) return <Screen scroll={false}><ErrorState message={error ?? 'Could not load'} onRetry={reload} /></Screen>;
  const lvl = xpLevel(o.stats.totalXp);
  return (
    <Screen>
      <H1>Rewards</H1>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card tone="sun" style={{ flex: 1 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.sunDark }}>{o.stats.totalStars}</Text>
          <Body>stars</Body>
        </Card>
        <Card tone="plum" style={{ flex: 1 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.plumDark }}>{`Lv ${lvl.level}`}</Text>
          <Meter value={lvl.intoLevel} max={lvl.levelSize} label="Experience towards the next level" color={colors.plum} />
        </Card>
      </View>
      <H2>Badges</H2>
      {o.badges.map((b) => (
        <Card key={b.key} tone={b.awardedAt ? 'paper' : 'sky'}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: b.awardedAt ? colors.ink : colors.inkSoft }}>{`${b.awardedAt ? '★ ' : ''}${b.title}`}</Text>
          <Body muted>{b.awardedAt ? b.description : `Not yet: ${b.description}`}</Body>
        </Card>
      ))}
    </Screen>
  );
}
