import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, glass, withAlpha } from '../theme';

/** True on iOS 26+, where UIKit renders real Liquid Glass. */
export const NATIVE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Extra bottom space a scrolling screen needs so its last item clears the
 * floating tab bar. Provided by tab layouts; 0 elsewhere.
 */
export const TabBarClearance = createContext(0);

/**
 * A Liquid Glass surface. Native glass on iOS 26+, a frosted translucent view
 * everywhere else. `tint` colours the glass (used for prominent buttons and
 * tinted cards); `interactive` enables the native press shimmer.
 */
export function Glass({
  children,
  style,
  tint,
  interactive,
  variant = 'regular',
  strong,
  testID,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  interactive?: boolean;
  variant?: 'regular' | 'clear';
  /** Fallback only: more opaque, for surfaces over a dim scrim (dialogs). */
  strong?: boolean;
  testID?: string;
}) {
  if (NATIVE_GLASS) {
    return (
      <GlassView
        testID={testID}
        glassEffectStyle={variant}
        tintColor={tint}
        isInteractive={interactive}
        colorScheme="light"
        style={[styles.native, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      testID={testID}
      style={[
        styles.fallback,
        variant === 'clear' && { backgroundColor: 'rgba(255,255,255,0.35)' },
        strong && { backgroundColor: glass.fillStrong },
        tint ? { backgroundColor: withAlpha(tint, 0.9), borderColor: withAlpha('#ffffff', 0.45) } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const BLOBS = [
  { id: 'a', color: colors.lagoon, cx: 40, cy: 90, r: 230 },
  { id: 'b', color: colors.sun, cx: 380, cy: 170, r: 200 },
  { id: 'c', color: colors.plum, cx: 30, cy: 470, r: 220 },
  { id: 'd', color: colors.sky, cx: 400, cy: 620, r: 240 },
  { id: 'e', color: colors.ember, cx: 120, cy: 820, r: 180 },
] as const;

/**
 * Soft, colourful wash behind every screen. Glass needs something to refract;
 * over flat white it would look like plain grey cards.
 */
export function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#e9f8f6" />
            <Stop offset="0.5" stopColor="#f1effd" />
            <Stop offset="1" stopColor="#e8f0fc" />
          </LinearGradient>
          {BLOBS.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={b.color} stopOpacity={0.42} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect x="0" y="0" width="400" height="860" fill="url(#wash)" />
        {BLOBS.map((b) => (
          <Circle key={b.id} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  native: { overflow: 'hidden' },
  fallback: {
    backgroundColor: glass.fill,
    borderWidth: 1.5,
    borderColor: glass.rim,
    shadowColor: glass.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
