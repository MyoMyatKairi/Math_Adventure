import { Redirect } from 'expo-router';
import { Loading, Screen } from '../src/components/ui';
import { useSession } from '../src/lib/session';

export default function Index() {
  const { loading, session, activeChildId } = useSession();
  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href={activeChildId ? '/learn' : '/profiles'} />;
}
