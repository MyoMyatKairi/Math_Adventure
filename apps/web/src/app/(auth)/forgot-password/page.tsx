import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forms';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.forgot.title') };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t('auth.forgot.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('auth.forgot.lead')}</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="font-semibold text-lagoon-dark underline underline-offset-4">
          {t('auth.forgot.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
