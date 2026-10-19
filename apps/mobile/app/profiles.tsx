import type { AvatarKey } from '@math-adventure/shared';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AvatarBadge, Button, EmptyState, ErrorState, H1, Loading, Screen } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { colors, radius } from '../src/theme';

interface Row {
  id: string;
  display_name: string;
  avatar_key: AvatarKey;
}

/** "Who's learning?" Picking a profile enters learner mode and locks the parent area. */
export default function Profiles() {
  const router = useRouter();
  const { loading, session, setActiveChild, lockParent } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from('child_profiles').select('id, display_name, avatar_key').is('archived_at', null).order('created_at');
    if (e) setError('We couldn’t load profiles.');
    else setRows(data as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button label="Grown-ups" variant="ghost" onPress={() => router.push('/parent-gate')} />
      </View>
      <H1>Who’s learning?</H1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <Loading /> : null}
      {rows && rows.length === 0 ? (
        <EmptyState title="No learners yet" body="A grown-up needs to add a learner first." action={<Button label="Add a learner" onPress={() => router.push('/parent-gate')} />} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows?.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Learn as ${c.display_name}`}
            onPress={async () => {
              await setActiveChild(c.id);
              lockParent();
              router.replace('/learn');
            }}
            style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.paper, borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 10, borderBottomWidth: 5, borderBottomColor: colors.line }}
          >
            <AvatarBadge avatarKey={c.avatar_key} name={c.display_name} size={72} />
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{c.display_name}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
