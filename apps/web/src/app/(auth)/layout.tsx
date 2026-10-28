import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n';
import { getT } from '@/lib/i18n';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={t('app.homeLink')}>
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md rounded-[2rem] bg-paper p-6 shadow-[0_6px_0_0_var(--color-line)] sm:p-8">{children}</div>
      </main>
    </div>
  );
}
