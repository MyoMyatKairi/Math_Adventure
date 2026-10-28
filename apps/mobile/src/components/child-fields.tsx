import { AGE_GROUPS, AVATAR_KEYS, LEARNING_LEVELS, levelForAgeGroup, type AgeGroup, type AvatarKey } from '@math-adventure/shared';
import { Pressable, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { colors, glass, radius } from '../theme';
import { AvatarBadge, Field } from './ui';

export interface ChildValues {
  displayName: string;
  avatarKey: AvatarKey;
  ageGroup: AgeGroup;
  learningLevelId: string;
}

export const defaultChild = (): ChildValues => ({ displayName: '', avatarKey: 'fox', ageGroup: '5-7', learningLevelId: levelForAgeGroup('5-7').id });

function Option({ label, selected, onPress, children }: { label: string; selected: boolean; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        minHeight: 52,
        padding: 8,
        borderRadius: radius.sm,
        borderWidth: 3,
        borderColor: selected ? colors.lagoon : glass.rim,
        backgroundColor: selected ? colors.lagoonSoft : glass.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children ?? <Text style={{ fontWeight: '800', color: colors.ink }}>{label}</Text>}
    </Pressable>
  );
}

/** Shared create/edit fields for a learner profile. */
export function ChildFields({ value, onChange, errors, levelTouched, setLevelTouched }: { value: ChildValues; onChange: (v: ChildValues) => void; errors: Record<string, string>; levelTouched: boolean; setLevelTouched: (b: boolean) => void }) {
  const t = useT();
  return (
    <View style={{ gap: 18 }}>
      <Field label={t('child.nickname')} value={value.displayName} onChangeText={(text) => onChange({ ...value, displayName: text })} maxLength={30} error={errors.displayName} hint={t('child.nicknameHintShort')} />
      <View accessibilityRole="radiogroup" accessibilityLabel={t('child.avatar')} style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{t('child.avatar')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AVATAR_KEYS.map((k) => (
            <Option key={k} label={t(`avatar.${k}`)} selected={value.avatarKey === k} onPress={() => onChange({ ...value, avatarKey: k })}>
              <AvatarBadge avatarKey={k} name={t(`avatar.${k}`)} size={40} />
            </Option>
          ))}
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('child.ageGroup')} style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{t('child.ageGroup')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {AGE_GROUPS.map((g) => (
            <View key={g} style={{ flex: 1 }}>
              <Option
                label={t('common.ages', { range: g.replace('-', '–') })}
                selected={value.ageGroup === g}
                onPress={() => onChange({ ...value, ageGroup: g, learningLevelId: levelTouched ? value.learningLevelId : levelForAgeGroup(g).id })}
              />
            </View>
          ))}
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('child.level')} style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{t('child.level')}</Text>
        {LEARNING_LEVELS.map((l) => (
          <Option
            key={l.id}
            label={`${t(`level.${l.key}`)}, ${t('child.levelAges', { min: l.minimumAge, max: l.maximumAge })}`}
            selected={value.learningLevelId === l.id}
            onPress={() => {
              setLevelTouched(true);
              onChange({ ...value, learningLevelId: l.id });
            }}
          />
        ))}
      </View>
    </View>
  );
}
