import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/forms';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Choose a new password</h1>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </>
  );
}
