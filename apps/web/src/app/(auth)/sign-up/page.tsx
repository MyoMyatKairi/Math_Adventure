import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/forms';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.signUp.title') };
}

export default async function SignUpPage() {
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t('auth.signUp.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('auth.signUp.lead')}</p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.signUp.haveAccount')}{' '}
        <Link href="/sign-in" className="font-semibold text-lagoon-dark underline underline-offset-4">
          {t('auth.signUp.signInLink')}
        </Link>
      </p>
    </>
  );
}
