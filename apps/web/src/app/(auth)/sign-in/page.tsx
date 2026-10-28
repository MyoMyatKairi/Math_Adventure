import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/auth/forms';
import { FormMessage } from '@/components/ui/field';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.signIn.meta') };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t('auth.signIn.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('auth.signIn.lead')}</p>
      {error === 'link' && (
        <div className="mt-4">
          <FormMessage>{t('auth.signIn.linkExpired')}</FormMessage>
        </div>
      )}
      <div className="mt-6">
        <SignInForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.signIn.newHere')}{' '}
        <Link href="/sign-up" className="font-semibold text-lagoon-dark underline underline-offset-4">
          {t('auth.signIn.createLink')}
        </Link>
      </p>
    </>
  );
}
