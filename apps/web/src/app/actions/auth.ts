'use server';

import { fieldErrors, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from '@math-adventure/shared';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { siteUrl } from '@/lib/env';
import { clearActiveChild } from '@/lib/learner';
import { lockParentArea, unlockParentArea } from '@/lib/parent-gate';
import { createClient } from '@/lib/supabase/server';

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  status?: 'idle' | 'error' | 'success' | 'check-email';
  /** Non-secret values echoed back so fields keep their text after a failed submit. */
  values?: Record<string, string>;
};

const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));

function keep(fd: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(fd.get(n) ?? '').slice(0, 254)]));
}

/** Only same-site relative paths, so links can't bounce users to other sites. */
function safeNext(next: unknown, fallback: string): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = keep(fd, ['displayName', 'email']);
  const parsed = signUpSchema.safeParse(entries(fd));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/parent`,
    },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) {
      return { status: 'error', values, message: 'An account with this email already exists. Sign in instead, or reset your password.' };
    }
    if (/password/i.test(error.message)) return { status: 'error', values, errors: { password: error.message } };
    if (error.status === 429 || /rate|too many/i.test(error.message)) {
      return { status: 'error', values, message: 'Too many sign-ups right now. Please wait a while and try again.' };
    }
    return { status: 'error', values, message: 'We could not create your account. Please try again in a moment.' };
  }
  if (!data.session) return { status: 'check-email', message: `We sent a confirmation link to ${parsed.data.email}. Open it to finish signing up.` };
  await unlockParentArea(data.session.user.id);
  redirect('/parent?welcome=1');
}

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = keep(fd, ['email']);
  const parsed = signInSchema.safeParse(entries(fd));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error && /confirm/i.test(error.message)) return { status: 'error', values, message: 'Please confirm your email address first. Check your inbox for the link.' };
    if (error && /rate|too many/i.test(error.message)) return { status: 'error', values, message: 'Too many attempts. Wait a minute and try again.' };
    return { status: 'error', values, message: 'That email and password don’t match an account.' };
  }
  await unlockParentArea(data.user.id);
  redirect(safeNext(fd.get('next'), '/parent'));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActiveChild();
  await lockParentArea();
  redirect('/');
}

export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse(entries(fd));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values: keep(fd, ['email']) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists, so emails can't be probed.
  return { status: 'success', message: 'If an account uses that email, a reset link is on its way. The link works once.' };
}

export async function updatePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = newPasswordSchema.safeParse(entries(fd));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: 'error', message: /different|same/i.test(error.message) ? 'Choose a password you haven’t used here before.' : 'We could not update your password. Request a new reset link and try again.' };
  }
  await unlockParentArea(user.id);
  redirect('/parent?password=updated');
}

/** Re-checks the parent's password before opening the parent area from learner mode. */
export async function parentGateAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const password = fd.get('password');
  if (typeof password !== 'string' || password.length === 0) return { status: 'error', errors: { password: 'Enter your password.' } };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password });
  if (error) return { status: 'error', errors: { password: 'That password isn’t right.' } };
  await unlockParentArea(user.id);
  redirect(safeNext(fd.get('next'), '/parent'));
}
