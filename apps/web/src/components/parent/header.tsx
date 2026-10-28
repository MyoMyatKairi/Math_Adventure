import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { getT } from '@/lib/i18n';

export async function ParentHeader() {
  const t = await getT();
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/parent" aria-label={t('parent.dashboardLink')}>
          <Logo />
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label={t('parent.nav')}>
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm">
            <Link href="/parent">{t('parent.dashboard')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/learn">{t('parent.learnerMode')}</Link>
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              {t('parent.signOut')}
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
