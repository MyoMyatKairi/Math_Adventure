'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import {
  parentGateAction,
  requestResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type FormState,
} from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, FormMessage, Input } from '@/components/ui/field';

const initial: FormState = { status: 'idle' };

function TextField({
  name,
  label,
  type = 'text',
  autoComplete,
  error,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
}) {
  const id = `${useId()}-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        required
      />
    </Field>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  if (state.status === 'check-email') return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormMessage>{state.message}</FormMessage>}
      <TextField key={`n-${state.values?.displayName}`} name="displayName" label="Your first name" autoComplete="given-name" error={state.errors?.displayName} defaultValue={state.values?.displayName} />
      <TextField key={`e-${state.values?.email}`} name="email" label="Email" type="email" autoComplete="email" error={state.errors?.email} defaultValue={state.values?.email} />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={state.errors?.password}
        hint="At least 8 characters, with a letter and a number."
      />
      <p className="text-sm text-ink-soft">
        This account is for a parent or carer aged 18 or over. You&apos;ll add your children as learners next.
      </p>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormMessage>{state.message}</FormMessage>}
      {next && <input type="hidden" name="next" value={next} />}
      <TextField key={`e-${state.values?.email}`} name="email" label="Email" type="email" autoComplete="email" error={state.errors?.email} defaultValue={state.values?.email} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" error={state.errors?.password} />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="font-semibold text-lagoon-dark underline underline-offset-4">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestResetAction, initial);
  if (state.status === 'success') return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField key={`e-${state.values?.email}`} name="email" label="Email" type="email" autoComplete="email" error={state.errors?.email} defaultValue={state.values?.email} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormMessage>{state.message}</FormMessage>}
      <TextField name="password" label="New password" type="password" autoComplete="new-password" error={state.errors?.password} hint="At least 8 characters, with a letter and a number." />
      <TextField name="confirm" label="Type it again" type="password" autoComplete="new-password" error={state.errors?.confirm} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Save new password
      </Button>
    </form>
  );
}

export function ParentGateForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(parentGateAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <TextField name="password" label="Parent password" type="password" autoComplete="current-password" error={state.errors?.password} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Open parent area
      </Button>
    </form>
  );
}
