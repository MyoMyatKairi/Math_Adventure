import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';

export function ParentHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/parent" aria-label="Parent dashboard">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Parent">
          <Button asChild variant="ghost" size="sm">
            <Link href="/parent">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/learn">Learner mode</Link>
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
