import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/forms';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.reset.title') };
}

export default async function ResetPasswordPage() {
  await requireUser();
  const t = await getT();
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t('auth.reset.title')}</h1>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </>
  );
}
