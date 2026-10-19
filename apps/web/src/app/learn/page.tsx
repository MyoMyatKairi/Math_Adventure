import type { AvatarKey } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { startLearningAction } from '@/app/actions/children';
import { Avatar } from '@/components/brand/avatar';
import { Logo } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormMessage } from '@/components/ui/field';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Who’s learning?' };

export default async function ProfilePicker({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  await requireUser();
  const { missing } = await searchParams;
  const supabase = await createClient();
  const { data: children, error } = await supabase
    .from('child_profiles')
    .select('id, display_name, avatar_key, learning_levels(name)')
    .is('archived_at', null)
    .order('created_at');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/parent-gate?next=/parent">Grown-ups</Link>
        </Button>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 text-center">
        <h1 className="font-display text-4xl font-extrabold">Who&apos;s learning?</h1>
        {missing && (
          <div className="mx-auto mt-4 max-w-md">
            <FormMessage>That profile isn&apos;t available. Pick another one.</FormMessage>
          </div>
        )}
        {error && (
          <div className="mx-auto mt-4 max-w-md">
            <FormMessage>We couldn&apos;t load profiles. Refresh to try again.</FormMessage>
          </div>
        )}
        {children && children.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="No learners yet"
              action={
                <Button asChild size="lg">
                  <Link href="/parent-gate?next=/parent/children/new">Add a learner</Link>
                </Button>
              }
            >
              A grown-up needs to add a learner profile first.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {children?.map((c) => {
              const level = (c.learning_levels as unknown as { name: string } | null)?.name;
              return (
                <li key={c.id}>
                  <form action={startLearningAction.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="flex w-full flex-col items-center gap-3 rounded-[2rem] bg-paper p-5 shadow-[0_5px_0_0_var(--color-line)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <Avatar avatarKey={c.avatar_key as AvatarKey} className="h-24 w-24" />
                      <span className="font-display text-2xl font-extrabold">{c.display_name}</span>
                      {level && <span className="text-sm font-semibold text-ink-soft">{level}</span>}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
