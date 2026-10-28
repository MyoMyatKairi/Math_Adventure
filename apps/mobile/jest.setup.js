/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockStore = new Map();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  setItemAsync: jest.fn(async (k, v) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k) => void mockStore.delete(k)),
}));

// Minimal Reanimated stand-in: layout animations render as plain Views in tests.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const anim = { springify: () => anim, duration: () => anim, delay: () => anim };
  return { __esModule: true, default: { View }, ZoomIn: anim, FadeInDown: anim };
});

// Liquid Glass is native-only (iOS 26+); tests render the frosted fallback.
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: View, GlassContainer: View, isLiquidGlassAvailable: () => false, isGlassEffectAPIAvailable: () => false };
});
