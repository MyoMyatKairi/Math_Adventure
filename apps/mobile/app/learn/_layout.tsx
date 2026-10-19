import { Loading, Screen } from '../../src/components/ui';
import { Redirect, Tabs } from 'expo-router';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

export default function LearnLayout() {
  const { loading, session, activeChildId } = useSession();
  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (!activeChildId) return <Redirect href="/profiles" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lagoonDark,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        tabBarStyle: { minHeight: 60 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarAccessibilityLabel: 'Adventure map' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarAccessibilityLabel: 'Rewards' }} />
      <Tabs.Screen name="lesson/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
