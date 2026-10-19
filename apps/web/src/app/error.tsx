'use client';
import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-bold">This page didn&apos;t load</h1>
      <p className="mt-2 text-ink-soft">Check your connection, then try again.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
