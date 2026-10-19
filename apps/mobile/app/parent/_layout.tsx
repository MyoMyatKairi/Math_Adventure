import { Loading, Screen } from '../../src/components/ui';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/lib/session';

export default function ParentLayout() {
  const { loading, session, isParentUnlocked } = useSession();
  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (!isParentUnlocked()) return <Redirect href="/parent-gate" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
