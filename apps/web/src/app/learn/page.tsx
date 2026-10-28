import { levelName, type AvatarKey } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { startLearningAction } from '@/app/actions/children';
import { Avatar } from '@/components/brand/avatar';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profiles.meta') };
}

export default async function ProfilePicker({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  await requireUser();
  const { missing } = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: children, error } = await supabase
    .from('child_profiles')
    .select('id, display_name, avatar_key, learning_level_id')
    .is('archived_at', null)
    .order('created_at');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm">
            <Link href="/parent-gate?next=/parent">{t('profiles.grownUps')}</Link>
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 text-center">
        <h1 className="font-display text-4xl font-extrabold">{t('profiles.title')}</h1>
        {missing && (
          <div className="mx-auto mt-4 max-w-md">
            <FormMessage>{t('profiles.missing')}</FormMessage>
          </div>
        )}
        {error && (
          <div className="mx-auto mt-4 max-w-md">
            <FormMessage>{t('profiles.loadFailed')}</FormMessage>
          </div>
        )}
        {children && children.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={t('profiles.emptyTitle')}
              action={
                <Button asChild size="lg">
                  <Link href="/parent-gate?next=/parent/children/new">{t('profiles.addLearner')}</Link>
                </Button>
              }
            >
              {t('profiles.emptyBody')}
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {children?.map((c) => (
              <li key={c.id}>
                <form action={startLearningAction.bind(null, c.id)}>
                  <button
                    type="submit"
                    className="flex w-full flex-col items-center gap-3 rounded-[2rem] bg-paper p-5 shadow-[0_5px_0_0_var(--color-line)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  >
                    <Avatar avatarKey={c.avatar_key as AvatarKey} className="h-24 w-24" />
                    <span className="font-display text-2xl font-extrabold">{c.display_name}</span>
                    <span className="text-sm font-semibold text-ink-soft">{levelName(c.learning_level_id, t)}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
