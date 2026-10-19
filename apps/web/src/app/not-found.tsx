import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-plum tabular">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">This path isn&apos;t on the map</h1>
      <p className="mt-2 text-ink-soft">The page may have moved, or the link has a typo.</p>
      <Button asChild className="mt-6">
        <Link href="/">Go to the start</Link>
      </Button>
    </main>
  );
}
