import { LOCALE_NAMES, LOCALES, type AvatarKey } from '@math-adventure/shared';
import { useContext, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useLocale, useT } from '../lib/i18n';
import { colors, glass, radius, space, TOUCH, withAlpha } from '../theme';
import { Backdrop, Glass, TabBarClearance } from './glass';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, scroll = true, testID }: { children: ReactNode; scroll?: boolean; testID?: string }) {
  const clearance = useContext(TabBarClearance);
  const pad = clearance ? { paddingBottom: clearance } : null;
  return (
    <View style={styles.root}>
      <Backdrop />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID={testID}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, pad]} keyboardShouldPersistTaps="handled">
            <View style={styles.column}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.column, pad, { flex: 1 }]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Glass card. `tone` tints the glass; `paper` is clear glass. */
export function Card({ children, style, tone = 'paper' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: keyof typeof CARD_TONES }) {
  const tint = CARD_TONES[tone];
  return (
    <Glass tint={tint ?? undefined} style={[styles.card, style]}>
      {children}
    </Glass>
  );
}
const CARD_TONES = {
  paper: null,
  lagoon: withAlpha(colors.lagoonSoft, 0.7),
  sun: withAlpha(colors.sunSoft, 0.7),
  plum: withAlpha(colors.plumSoft, 0.7),
  ember: withAlpha(colors.emberSoft, 0.7),
  sky: withAlpha(colors.skySoft, 0.7),
  ink: colors.ink,
};

export function H1({ children, color = colors.ink }: { children: ReactNode; color?: string }) {
  return (
    <Text accessibilityRole="header" style={[styles.h1, { color }]}>
      {children}
    </Text>
  );
}
export function H2({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.h2}>
      {children}
    </Text>
  );
}
export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: colors.inkSoft }, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'sun' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  size = 'md',
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  accessibilityLabel?: string;
  testID?: string;
}) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }, inactive && { opacity: 0.5 }]}
    >
      {v.glass ? (
        <Glass tint={v.tint} interactive style={[styles.button, { minHeight: size === 'lg' ? 60 : TOUCH }]}>
          {loading && <ActivityIndicator color={v.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: v.fg, fontSize: size === 'lg' ? 20 : 17 }]}>{label}</Text>
        </Glass>
      ) : (
        <View style={[styles.button, { minHeight: size === 'lg' ? 60 : TOUCH }]}>
          {loading && <ActivityIndicator color={v.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: v.fg, fontSize: size === 'lg' ? 20 : 17 }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
/** Prominent actions are tinted glass capsules; secondary is clear glass; ghost is bare text. */
const VARIANTS: Record<Variant, { fg: string; glass: boolean; tint?: string }> = {
  primary: { fg: '#fff', glass: true, tint: colors.lagoon },
  secondary: { fg: colors.ink, glass: true },
  sun: { fg: colors.ink, glass: true, tint: colors.sun },
  ghost: { fg: colors.inkSoft, glass: false },
  danger: { fg: '#fff', glass: true, tint: colors.emberDark },
};

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9aa4bf"
        style={[styles.input, error ? { borderColor: colors.ember } : null]}
        {...props}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Message({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const t = { error: [colors.emberSoft, colors.emberDark], success: [colors.lagoonSoft, colors.lagoonDark], info: [colors.skySoft, colors.ink] }[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: t[0] }]}>
      <Text style={{ color: t[1], fontWeight: '600', fontSize: 15 }}>{children}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <View style={styles.center} accessibilityLabel={label ?? t('common.loading')} accessibilityRole="progressbar" testID="loading">
      <ActivityIndicator size="large" color={colors.lagoon} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <View style={[styles.center, { gap: 12 }]} testID="error-state">
      <Message>{message}</Message>
      <Button label={t('common.tryAgain')} onPress={onRetry} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <H2>{title}</H2>
      {body ? <Body muted style={{ textAlign: 'center' }}>{body}</Body> : null}
      {action}
    </View>
  );
}

export function Meter({ value, max, label, color = colors.lagoon }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={styles.meter}
    >
      <View style={{ width: `${pct}%`, backgroundColor: color, height: '100%', borderRadius: 999 }} />
    </View>
  );
}

export function StarRow({ count, max = 3, size = 22 }: { count: number; max?: number; size?: number }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessible accessibilityLabel={t('common.starsOf', { count, max })}>
      {Array.from({ length: max }, (_, i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1L3.2 9.2l6.1-.8z"
            fill={i < count ? colors.sun : 'none'}
            stroke={i < count ? '#d99a0f' : colors.line}
            strokeWidth={1.6}
          />
        </Svg>
      ))}
    </View>
  );
}

const AVATAR_COLORS: Record<AvatarKey, [string, string]> = {
  fox: ['#ffe6cc', '#e8781e'],
  owl: ['#e9e1fb', '#8a603d'],
  panda: ['#dcf5f2', '#1c2541'],
  turtle: ['#fff3d6', '#2f9a5b'],
  rocket: ['#1c2541', '#ffc23d'],
  robot: ['#e3eefc', '#4a5578'],
  whale: ['#e3eefc', '#4f8fe8'],
  lion: ['#fff3d6', '#c9771a'],
};

/** Compact avatar: the profile's colours and initial. */
export function AvatarBadge({ avatarKey, name, size = 48 }: { avatarKey: AvatarKey; name: string; size?: number }) {
  const [bg, fg] = AVATAR_COLORS[avatarKey] ?? AVATAR_COLORS.fox;
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: fg }}
    >
      <Text style={{ color: fg, fontWeight: '900', fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.dialogWrap}>
          <Glass strong style={styles.dialog}>
            <H2>{title}</H2>
            <Body muted>{body}</Body>
            <View style={{ gap: 8, marginTop: 8 }}>
              <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} />
              <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
            </View>
          </Glass>
        </View>
      </View>
    </Modal>
  );
}

/** Language picker: one pill per language, each written in its own script. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('common.language')} style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {LOCALES.map((l) => {
        const selected = l === locale;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityLabel={LOCALE_NAMES[l]}
            accessibilityState={{ checked: selected }}
            onPress={() => setLocale(l)}
          >
            <Glass tint={selected ? colors.lagoon : undefined} interactive style={styles.pill}>
              <Text style={{ fontWeight: '800', color: selected ? '#fff' : colors.inkSoft }}>{LOCALE_NAMES[l]}</Text>
            </Glass>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: space(4), paddingVertical: space(4), paddingBottom: space(10) },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space(4) },
  card: { borderRadius: radius.xl, padding: space(5), gap: space(2) },
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { fontSize: 17, lineHeight: 25, color: colors.ink },
  label: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.inkSoft },
  error: { fontSize: 14, fontWeight: '600', color: colors.emberDark },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: glass.rim,
    borderRadius: radius.md,
    backgroundColor: glass.fillStrong,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 22,
  },
  buttonText: { fontWeight: '800' },
  pill: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  message: { borderRadius: radius.md, padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: glass.rim, backgroundColor: 'rgba(255,255,255,0.3)' },
  meter: { height: 12, width: '100%', borderRadius: 999, backgroundColor: 'rgba(28,37,65,0.1)', overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,37,65,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogWrap: { width: '100%', maxWidth: 420 },
  dialog: { borderRadius: radius.xl, padding: 24, gap: 8 },
});
