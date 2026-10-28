import { Loading, Screen } from '../../src/components/ui';
import { Glass, TabBarClearance } from '../../src/components/glass';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../src/lib/i18n';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

const BAR_HEIGHT = 64;

export default function LearnLayout() {
  const { loading, session, activeChildId } = useSession();
  const insets = useSafeAreaInsets();
  const t = useT();
  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (!activeChildId) return <Redirect href="/profiles" />;
  const barBottom = Math.max(insets.bottom, 12);
  return (
    <TabBarClearance.Provider value={BAR_HEIGHT + barBottom + 24}>
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.lagoonDark,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
          // Floating Liquid Glass capsule over the content.
          tabBarStyle: {
            position: 'absolute',
            bottom: barBottom,
            marginHorizontal: 20,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            elevation: 0,
          },
          tabBarItemStyle: { paddingVertical: 8 },
          tabBarBackground: () => <Glass style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2 }]} />,
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarAccessibilityLabel: t('nav.home') }} />
        <Tabs.Screen name="map" options={{ title: t('nav.map'), tabBarAccessibilityLabel: t('nav.mapLong') }} />
        <Tabs.Screen name="rewards" options={{ title: t('nav.rewards'), tabBarAccessibilityLabel: t('nav.rewards') }} />
        <Tabs.Screen name="lesson/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="practice" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </TabBarClearance.Provider>
  );
}
