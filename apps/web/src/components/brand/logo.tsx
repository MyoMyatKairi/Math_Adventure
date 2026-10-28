'use client';

import { useT } from '@/components/i18n';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  const t = useT();
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-extrabold text-ink', className)}>
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <path d="M6 30c6-14 22-2 28-18" fill="none" stroke="var(--color-lagoon)" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 7" />
        <circle cx="6" cy="30" r="5" fill="var(--color-plum)" />
        <path d="M34 4l2.2 4.6 5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.4 5-.7z" fill="var(--color-sun)" stroke="#d99a0f" strokeWidth="1" />
      </svg>
      {t('app.name')}
    </span>
  );
}
