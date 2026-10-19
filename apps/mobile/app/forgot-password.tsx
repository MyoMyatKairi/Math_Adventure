import { fieldErrors, resetRequestSchema } from '@math-adventure/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Message, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) return setError(fieldErrors(parsed.error).email);
    setBusy(true);
    // The reset link opens the web app, where the new password is chosen.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${WEB_URL}/auth/callback?next=/reset-password` });
    setBusy(false);
    setSent(true);
  }

  return (
    <Screen>
      <H1>Reset your password</H1>
      {sent ? (
        <Message tone="success">If an account uses that email, a reset link is on its way.</Message>
      ) : (
        <>
          <Body muted>We’ll email you a link to choose a new password.</Body>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
          <Button label="Send reset link" size="lg" onPress={submit} loading={busy} />
        </>
      )}
      <Link href="/sign-in" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        Back to sign in
      </Link>
    </Screen>
  );
}
