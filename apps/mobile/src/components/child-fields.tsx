import { AGE_GROUPS, AVATAR_KEYS, LEARNING_LEVELS, levelForAgeGroup, type AgeGroup, type AvatarKey } from '@math-adventure/shared';
import { Pressable, Text, View } from 'react-native';
import { colors, radius } from '../theme';
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
        borderColor: selected ? colors.lagoon : colors.line,
        backgroundColor: selected ? colors.lagoonSoft : colors.paper,
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
  return (
    <View style={{ gap: 18 }}>
      <Field label="Nickname" value={value.displayName} onChangeText={(t) => onChange({ ...value, displayName: t })} maxLength={30} error={errors.displayName} hint="A first name or nickname is plenty." />
      <View accessibilityRole="radiogroup" accessibilityLabel="Avatar" style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Avatar</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AVATAR_KEYS.map((k) => (
            <Option key={k} label={k} selected={value.avatarKey === k} onPress={() => onChange({ ...value, avatarKey: k })}>
              <AvatarBadge avatarKey={k} name={k} size={40} />
            </Option>
          ))}
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Age group" style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Age group</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {AGE_GROUPS.map((g) => (
            <View key={g} style={{ flex: 1 }}>
              <Option
                label={`Ages ${g}`}
                selected={value.ageGroup === g}
                onPress={() => onChange({ ...value, ageGroup: g, learningLevelId: levelTouched ? value.learningLevelId : levelForAgeGroup(g).id })}
              />
            </View>
          ))}
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Starting level" style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Starting level</Text>
        {LEARNING_LEVELS.map((l) => (
          <Option
            key={l.id}
            label={`${l.name}, ages ${l.minimumAge} to ${l.maximumAge}`}
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
