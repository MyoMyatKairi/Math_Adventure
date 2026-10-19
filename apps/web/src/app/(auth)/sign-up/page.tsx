import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Create a parent account' };

export default function SignUpPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Create a parent account</h1>
      <p className="mt-2 text-ink-soft">Free during early access.</p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold text-lagoon-dark underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
