import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/auth/forms';
import { FormMessage } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-ink-soft">Sign in with your parent account.</p>
      {error === 'link' && (
        <div className="mt-4">
          <FormMessage>That link has expired or was already used. Sign in, or request a new password reset link.</FormMessage>
        </div>
      )}
      <div className="mt-6">
        <SignInForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{' '}
        <Link href="/sign-up" className="font-semibold text-lagoon-dark underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
