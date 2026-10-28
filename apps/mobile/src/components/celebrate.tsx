import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const COLORS = [colors.sun, colors.lagoon, colors.plum, colors.ember, colors.sky];

/** A one-off confetti shower. Skipped when the device asks for reduced motion. */
export function Confetti({ pieces = 40 }: { pieces?: number }) {
  const [reduce, setReduce] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        spin: 360 + Math.random() * 540,
        delay: Math.random() * 0.25,
        size: 8 + Math.random() * 6,
        color: COLORS[i % COLORS.length]!,
        round: i % 3 === 0,
      })),
    [pieces, width],
  );

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (!live) return;
        setReduce(r);
        if (!r) Animated.timing(progress, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [progress]);

  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bits.map((b, i) => {
        const p = progress.interpolate({ inputRange: [b.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: b.x,
              top: -20,
              width: b.size,
              height: b.size * 1.4,
              borderRadius: b.round ? b.size : 2,
              backgroundColor: b.color,
              transform: [
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
