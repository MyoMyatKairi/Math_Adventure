/** Same tokens as the web app (apps/web/src/app/globals.css). */
export const colors = {
  ink: '#1c2541',
  inkSoft: '#4a5578',
  chalk: '#f2f6fc',
  paper: '#ffffff',
  line: '#d9e2f0',
  lagoon: '#0e9f94',
  lagoonDark: '#0a7d74',
  lagoonSoft: '#dcf5f2',
  sun: '#ffc23d',
  sunDark: '#8a5a00',
  sunSoft: '#fff3d6',
  ember: '#e8781e',
  emberDark: '#a3510c',
  emberSoft: '#fdeee0',
  plum: '#7c5ce0',
  plumDark: '#5b3fc0',
  plumSoft: '#eee9fd',
  sky: '#4f8fe8',
  skySoft: '#e3eefc',
} as const;

/**
 * Liquid Glass surfaces. On iOS 26+ real glass (expo-glass-effect) is used and
 * these are only the fallback for Android / older iOS: frosted white with a
 * bright rim so cards still read as glass over the colourful backdrop.
 */
export const glass = {
  fill: 'rgba(255,255,255,0.62)',
  fillStrong: 'rgba(255,255,255,0.82)',
  rim: 'rgba(255,255,255,0.95)',
  shadow: '#1c2541',
} as const;

/** `#rrggbb` + alpha (0..1) → `#rrggbbaa`. */
export function withAlpha(hex: string, alpha: number) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

export const radius ={ sm: 12, md: 18, lg: 24, xl: 32 } as const;
export const space = (n: number) => n * 4;
/** Minimum touch target (Apple HIG 44pt; we go bigger for young learners). */
export const TOUCH = 52;
