import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Reset your password</h1>
      <p className="mt-2 text-ink-soft">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="font-semibold text-lagoon-dark underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
