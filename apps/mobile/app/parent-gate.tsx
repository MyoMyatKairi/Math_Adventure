import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Screen } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';

/** Grown-ups only: re-enter the account password to open the parent area. */
export default function ParentGate() {
  const router = useRouter();
  const { session, unlockParent } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password) return setError('Enter your password.');
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: session?.user.email ?? '', password });
    setBusy(false);
    if (e) return setError('That password isn’t right.');
    unlockParent();
    router.replace('/parent');
  }

  return (
    <Screen>
      <H1>Grown-ups only</H1>
      <Body muted>{`Enter the password for ${session?.user.email ?? 'this account'} to open the parent area.`}</Body>
      <Field label="Parent password" value={password} onChangeText={setPassword} secureTextEntry error={error} />
      <Button label="Open parent area" size="lg" onPress={submit} loading={busy} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
