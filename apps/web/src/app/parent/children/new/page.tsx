import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildForm } from '@/components/parent/child-form';
import { requireParentArea } from '@/lib/parent-area';

export const metadata: Metadata = { title: 'Add a learner' };

export default async function NewChildPage() {
  await requireParentArea('/parent/children/new');
  return (
    <div className="max-w-2xl">
      <Link href="/parent" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
        Back to dashboard
      </Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold">Add a learner</h1>
      <p className="mt-1 text-ink-soft">We don&apos;t ask for full names, birthdays or photos.</p>
      <div className="mt-8 rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
        <ChildForm />
      </div>
    </div>
  );
}
