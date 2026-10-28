import { fieldErrors, resetRequestSchema } from '@math-adventure/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Message, Screen } from '../src/components/ui';
import { useLocale } from '../src/lib/i18n';
import { supabase } from '../src/lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3003';

export default function ForgotPassword() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = resetRequestSchema.safeParse({ email });
    if (!parsed.success) return setError(fieldErrors(parsed.error, locale).email);
    setBusy(true);
    // The reset link opens the web app, where the new password is chosen.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${WEB_URL}/auth/callback?next=/reset-password` });
    setBusy(false);
    setSent(true);
  }

  return (
    <Screen>
      <H1>{t('auth.forgot.title')}</H1>
      {sent ? (
        <Message tone="success">{t('auth.msg.resetSent')}</Message>
      ) : (
        <>
          <Body muted>{t('auth.forgot.lead')}</Body>
          <Field label={t('auth.field.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
          <Button label={t('auth.forgot.submit')} size="lg" onPress={submit} loading={busy} />
        </>
      )}
      <Link href="/sign-in" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        {t('auth.forgot.backToSignIn')}
      </Link>
    </Screen>
  );
}
