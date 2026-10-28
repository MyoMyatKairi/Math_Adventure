import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ParentGateForm } from '@/components/auth/forms';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('gate.meta') };
}

export default async function ParentGatePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  const { next } = await searchParams;
  const t = await getT();
  const [before, after] = t('gate.lead', { email: '\u0000' }).split('\u0000');
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-8">
        <div className="w-full max-w-md rounded-[2rem] bg-paper p-6 shadow-[0_6px_0_0_var(--color-line)] sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-plum-soft text-plum-dark">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold">{t('gate.title')}</h1>
          <p className="mt-2 text-ink-soft">
            {before}
            <span className="font-semibold text-ink">{user.email}</span>
            {after}
          </p>
          <div className="mt-6">
            <ParentGateForm next={next} />
          </div>
          <p className="mt-6 text-center">
            <Link href="/learn/home" className="font-semibold text-lagoon-dark underline underline-offset-4">
              {t('gate.backToLearning')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
