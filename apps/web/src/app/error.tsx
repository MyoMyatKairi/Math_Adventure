'use client';
import { useT } from '@/components/i18n';
import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-bold">{t('errorPage.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('errorPage.body')}</p>
      <Button className="mt-6" onClick={reset}>
        {t('common.tryAgain')}
      </Button>
    </main>
  );
}
