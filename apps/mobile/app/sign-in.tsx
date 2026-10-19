import { signInSchema, fieldErrors } from '@math-adventure/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Message, Screen } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { isConfigured, supabase } from '../src/lib/supabase';

export default function SignIn() {
  const router = useRouter();
  const { unlockParent } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return setMessage(/confirm/i.test(error.message) ? 'Please confirm your email address first.' : 'That email and password don’t match an account.');
    unlockParent();
    router.replace('/profiles');
  }

  return (
    <Screen>
      <H1>Welcome back</H1>
      <Body muted>Sign in with your parent account.</Body>
      {!isConfigured ? <Message>App is missing its Supabase settings. See docs/setup.md.</Message> : null}
      {message ? <Message>{message}</Message> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={errors.password} />
      <Button label="Sign in" size="lg" onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        Forgot your password?
      </Link>
      <Link href="/sign-up" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        New here? Create an account
      </Link>
    </Screen>
  );
}
