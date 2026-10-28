import type { AvatarKey } from '@math-adventure/shared';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Glass } from '../src/components/glass';
import { AvatarBadge, Button, EmptyState, ErrorState, H1, LanguageSwitcher, Loading, Screen } from '../src/components/ui';
import { useT } from '../src/lib/i18n';
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
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from('child_profiles').select('id, display_name, avatar_key').is('archived_at', null).order('created_at');
    if (e) setError(t('profiles.loadFailed'));
    else setRows(data as Row[]);
  }, [t]);
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <LanguageSwitcher />
        <Button label={t('profiles.grownUps')} variant="ghost" onPress={() => router.push('/parent-gate')} />
      </View>
      <H1>{t('profiles.title')}</H1>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!rows && !error ? <Loading /> : null}
      {rows && rows.length === 0 ? (
        <EmptyState title={t('profiles.emptyTitle')} body={t('profiles.emptyBody')} action={<Button label={t('profiles.addLearner')} onPress={() => router.push('/parent-gate')} />} />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows?.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={t('profiles.learnAs', { name: c.display_name })}
            onPress={async () => {
              await setActiveChild(c.id);
              lockParent();
              router.replace('/learn');
            }}
            style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <Glass interactive style={{ borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 10 }}>
              <AvatarBadge avatarKey={c.avatar_key} name={c.display_name} size={72} />
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{c.display_name}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
