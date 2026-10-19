import { fieldErrors, signUpSchema } from '@math-adventure/shared';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Field, H1, Message, Screen } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';

export default function SignUp() {
  const router = useRouter();
  const { unlockParent } = useSession();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName } },
    });
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: /registered|exists/i.test(error.message) ? 'An account with this email already exists.' : 'We could not create your account. Try again.' });
    if (!data.session) return setMessage({ tone: 'success', text: `We sent a confirmation link to ${parsed.data.email}.` });
    unlockParent();
    router.replace('/parent');
  }

  return (
    <Screen>
      <H1>Create a parent account</H1>
      <Body muted>For a parent or carer aged 18 or over. You’ll add children as learners next.</Body>
      {message ? <Message tone={message.tone}>{message.text}</Message> : null}
      <Field label="Your first name" value={form.displayName} onChangeText={set('displayName')} error={errors.displayName} />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry hint="At least 8 characters, with a letter and a number." error={errors.password} />
      <Button label="Create account" size="lg" onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: '#0a7d74', fontWeight: '700', textAlign: 'center' }}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}
