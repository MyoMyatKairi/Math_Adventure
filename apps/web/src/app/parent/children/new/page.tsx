import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildForm } from '@/components/parent/child-form';
import { getT } from '@/lib/i18n';
import { requireParentArea } from '@/lib/parent-area';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('child.newMeta') };
}

export default async function NewChildPage() {
  await requireParentArea('/parent/children/new');
  const t = await getT();
  return (
    <div className="max-w-2xl">
      <Link href="/parent" className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
        {t('report.back')}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold">{t('child.newTitle')}</h1>
      <p className="mt-1 text-ink-soft">{t('child.newLead')}</p>
      <div className="mt-8 rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
        <ChildForm />
      </div>
    </div>
  );
}
