import type { PublicQuestion, QuestionType } from '@math-adventure/shared';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../lib/i18n';
import { colors, glass, radius } from '../theme';
import { Visual } from './visual';

export interface AnswerInputProps {
  question: PublicQuestion;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  ageGroup: '5-7' | '8-10' | '11-12';
}

/** Question-type registry, same contract as the web app. Add a type here; the player is unchanged. */
export const ANSWER_INPUTS: Record<QuestionType, ComponentType<AnswerInputProps>> = {
  multiple_choice: Choices,
  numeric: NumberPad,
  missing_number: NumberPad,
  pattern: NumberPad,
  compare: Compare,
  visual_quantity: (p) => (p.question.options?.length ? <Choices {...p} /> : <NumberPad {...p} />),
};

function Choices({ question, value, onChange, disabled }: AnswerInputProps) {
  const t = useT();
  const options = question.options ?? [];
  const numeric = options.every((o) => /^-?\d+$/.test(o.label));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('input.answers')} style={[s.wrap, numeric && { flexDirection: 'row' }]}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.id)}
            style={[s.choice, numeric && { flex: 1 }, selected && s.selected]}
          >
            {o.visual ? (
              <View style={{ width: 40 }}>
                <Visual visual={o.visual} small />
              </View>
            ) : null}
            <Text style={[s.choiceText, numeric && { fontSize: 28 }, selected && { color: colors.plumDark }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SYMBOLS = [
  { v: '<', name: 'input.lessThan' },
  { v: '=', name: 'input.equalTo' },
  { v: '>', name: 'input.greaterThan' },
] as const;

function Compare({ value, onChange, disabled }: AnswerInputProps) {
  const t = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('input.compareSign')} style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
      {SYMBOLS.map((x) => (
        <Pressable
          key={x.v}
          accessibilityRole="radio"
          accessibilityLabel={t(x.name)}
          accessibilityState={{ checked: value === x.v, disabled }}
          disabled={disabled}
          onPress={() => onChange(x.v)}
          style={[s.symbol, value === x.v && s.selected]}
        >
          <Text style={{ fontSize: 40, fontWeight: '900', color: value === x.v ? colors.plumDark : colors.ink }}>{x.v}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NumberPad({ question, value, onChange, onSubmit, disabled, ageGroup }: AnswerInputProps) {
  const t = useT();
  const fraction = question.answerFormat === 'fraction' || question.answerFormat === 'simplest_fraction';
  const extras = ageGroup === '5-7' ? ['0'] : fraction ? ['-', '0', '/'] : ['-', '0', '.'];
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ...extras];
  return (
    <View style={{ alignSelf: 'center', width: '100%', maxWidth: 320, gap: 10 }}>
      <TextInput
        testID="answer-input"
        accessibilityLabel={t('input.yourAnswer')}
        value={value}
        onChangeText={(t) => onChange(t.slice(0, 32))}
        onSubmitEditing={onSubmit}
        editable={!disabled}
        keyboardType={fraction ? 'numbers-and-punctuation' : 'numbers-and-punctuation'}
        returnKeyType="done"
        placeholder={question.answerFormat === 'decimal' ? t('input.placeholderDecimal') : fraction ? t('input.placeholderFraction') : t('input.yourAnswer')}
        placeholderTextColor="#9aa4bf"
        style={s.display}
      />
      <View style={s.pad}>
        {keys.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === '-' ? t('input.minus') : k === '.' ? t('input.decimalPoint') : k === '/' ? t('input.fractionBar') : k}
            disabled={disabled}
            onPress={() => value.length < 20 && onChange(value + k)}
            style={({ pressed }) => [s.key, pressed && { transform: [{ translateY: 2 }] }, disabled && { opacity: 0.5 }]}
          >
            <Text style={s.keyText}>{k === '-' ? '−' : k}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('input.delete')}
          disabled={disabled || value.length === 0}
          onPress={() => onChange(value.slice(0, -1))}
          style={[s.key, { backgroundColor: 'rgba(255,255,255,0.4)' }]}
        >
          <Text style={[s.keyText, { color: colors.inkSoft }]}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10, flexWrap: 'wrap' },
  choice: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: glass.rim,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
  },
  selected: { borderColor: colors.plum, backgroundColor: colors.plumSoft },
  choiceText: { fontSize: 20, fontWeight: '800', color: colors.ink },
  symbol: { width: 76, height: 76, borderRadius: 22, borderWidth: 2, borderColor: glass.rim, backgroundColor: glass.fill, alignItems: 'center', justifyContent: 'center' },
  display: { height: 64, borderRadius: radius.md, borderWidth: 2, borderColor: glass.rim, backgroundColor: glass.fillStrong, textAlign: 'center', fontSize: 34, fontWeight: '900', color: colors.ink },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  key: { width: '30%', height: 56, borderRadius: radius.md, backgroundColor: glass.fill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: glass.rim },
  keyText: { fontSize: 26, fontWeight: '900', color: colors.ink },
});
