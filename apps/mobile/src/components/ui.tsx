import type { AvatarKey } from '@math-adventure/shared';
import type { ReactNode } from 'react';
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
import { colors, radius, space, TOUCH } from '../theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, scroll = true, testID }: { children: ReactNode; scroll?: boolean; testID?: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.scroll, styles.column, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone = 'paper' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: keyof typeof CARD_TONES }) {
  return <View style={[styles.card, { backgroundColor: CARD_TONES[tone] }, tone === 'paper' && styles.cardShadow, style]}>{children}</View>;
}
const CARD_TONES = {
  paper: colors.paper,
  lagoon: colors.lagoonSoft,
  sun: colors.sunSoft,
  plum: colors.plumSoft,
  ember: colors.emberSoft,
  sky: colors.skySoft,
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
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border, minHeight: size === 'lg' ? 60 : TOUCH },
        v.shadow && !pressed && { borderBottomWidth: 4, borderBottomColor: v.shadow },
        pressed && { transform: [{ translateY: 2 }] },
        inactive && { opacity: 0.5 },
      ]}
    >
      {loading && <ActivityIndicator color={v.fg} style={{ marginRight: 8 }} />}
      <Text style={[styles.buttonText, { color: v.fg, fontSize: size === 'lg' ? 20 : 17 }]}>{label}</Text>
    </Pressable>
  );
}
const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; shadow?: string }> = {
  primary: { bg: colors.lagoon, fg: '#fff', border: colors.lagoon, shadow: colors.lagoonDark },
  secondary: { bg: colors.paper, fg: colors.ink, border: colors.line, shadow: colors.line },
  sun: { bg: colors.sun, fg: colors.ink, border: colors.sun, shadow: '#d99a0f' },
  ghost: { bg: 'transparent', fg: colors.inkSoft, border: 'transparent' },
  danger: { bg: colors.emberDark, fg: '#fff', border: colors.emberDark, shadow: '#6e3507' },
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

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label} accessibilityRole="progressbar" testID="loading">
      <ActivityIndicator size="large" color={colors.lagoon} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={[styles.center, { gap: 12 }]} testID="error-state">
      <Message>{message}</Message>
      <Button label="Try again" onPress={onRetry} />
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
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessible accessibilityLabel={`${count} of ${max} stars`}>
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <H2>{title}</H2>
          <Body muted>{body}</Body>
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} />
            <Button label="Cancel" variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chalk },
  scroll: { paddingHorizontal: space(4), paddingVertical: space(4), paddingBottom: space(10) },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space(4) },
  card: { borderRadius: radius.lg, padding: space(5), gap: space(2) },
  cardShadow: { borderBottomWidth: 4, borderBottomColor: colors.line },
  h1: { fontSize: 30, fontWeight: '900', letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { fontSize: 17, lineHeight: 25, color: colors.ink },
  label: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.inkSoft },
  error: { fontSize: 14, fontWeight: '600', color: colors.emberDark },
  input: {
    minHeight: TOUCH,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: 20,
  },
  buttonText: { fontWeight: '800' },
  message: { borderRadius: radius.sm, padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line },
  meter: { height: 12, width: '100%', borderRadius: 999, backgroundColor: '#e5ebf4', overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,37,65,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: radius.lg, padding: 24, gap: 8 },
});
