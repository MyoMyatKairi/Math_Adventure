import { fieldErrors, signUpSchema } from '@math-adventure/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, LanguageSwitcher, Message, Screen } from '../src/components/ui';
import { useLocale } from '../src/lib/i18n';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';

export default function SignUp() {
  const router = useRouter();
  const { unlockParent } = useSession();
  const { locale, t } = useLocale();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error, locale));
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: t(/registered|exists/i.test(error.message) ? 'auth.msg.accountExists' : 'auth.msg.signUpFailed') });
    if (!data.session) return setMessage({ tone: 'success', text: t('auth.msg.checkEmail', { email: parsed.data.email }) });
    unlockParent();
    router.replace('/parent');
  }

  return (
    <Screen>
      <LanguageSwitcher />
      <H1>{t('auth.signUp.title')}</H1>
      <Body muted>{t('auth.signUp.adultNote')}</Body>
      {message ? <Message tone={message.tone}>{message.text}</Message> : null}
      <Field label={t('auth.field.firstName')} value={form.displayName} onChangeText={set('displayName')} error={errors.displayName} />
      <Field label={t('auth.field.email')} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <Field label={t('auth.field.password')} value={form.password} onChangeText={set('password')} secureTextEntry hint={t('auth.field.passwordHint')} error={errors.password} />
      <Button label={t('auth.signUp.submit')} size="lg" onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        {t('auth.signUp.haveAccountSignIn')}
      </Link>
    </Screen>
  );
}
