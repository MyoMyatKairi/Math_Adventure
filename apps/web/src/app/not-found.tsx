import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getT } from '@/lib/i18n';

export default async function NotFound() {
  const t = await getT();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-plum tabular">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('notFound.body')}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t('notFound.home')}</Link>
      </Button>
    </main>
  );
}
