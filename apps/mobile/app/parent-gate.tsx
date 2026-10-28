import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Screen } from '../src/components/ui';
import { useT } from '../src/lib/i18n';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';

/** Grown-ups only: re-enter the account password to open the parent area. */
export default function ParentGate() {
  const router = useRouter();
  const t = useT();
  const { session, unlockParent } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password) return setError(t('auth.msg.enterPassword'));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: session?.user.email ?? '', password });
    setBusy(false);
    if (e) return setError(t('auth.msg.wrongPassword'));
    unlockParent();
    router.replace('/parent');
  }

  return (
    <Screen>
      <H1>{t('gate.title')}</H1>
      <Body muted>{t('gate.lead', { email: session?.user.email ?? t('gate.thisAccount') })}</Body>
      <Field label={t('auth.field.parentPassword')} value={password} onChangeText={setPassword} secureTextEntry error={error} />
      <Button label={t('gate.submit')} size="lg" onPress={submit} loading={busy} />
      <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
