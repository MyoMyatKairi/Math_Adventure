import { signInSchema, fieldErrors } from '@math-adventure/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, LanguageSwitcher, Message, Screen } from '../src/components/ui';
import { useLocale } from '../src/lib/i18n';
import { useSession } from '../src/lib/session';
import { isConfigured, supabase } from '../src/lib/supabase';

export default function SignIn() {
  const router = useRouter();
  const { unlockParent } = useSession();
  const { locale, t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error, locale));
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return setMessage(t(/confirm/i.test(error.message) ? 'auth.msg.confirmFirst' : 'auth.msg.wrongLogin'));
    unlockParent();
    router.replace('/profiles');
  }

  return (
    <Screen>
      <LanguageSwitcher />
      <H1>{t('auth.signIn.title')}</H1>
      <Body muted>{t('auth.signIn.lead')}</Body>
      {!isConfigured ? <Message>{t('auth.msg.missingConfig')}</Message> : null}
      {message ? <Message>{message}</Message> : null}
      <Field label={t('auth.field.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.email} />
      <Field label={t('auth.field.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={errors.password} />
      <Button label={t('auth.signIn.submit')} size="lg" onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        {t('auth.signIn.forgot')}
      </Link>
      <Link href="/sign-up" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        {t('auth.signIn.newHereCreate')}
      </Link>
    </Screen>
  );
}
