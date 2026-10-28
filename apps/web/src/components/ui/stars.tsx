'use client';

import { useT } from '@/components/i18n';
import { cn } from '@/lib/utils';

export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} aria-hidden="true">
      <path
        d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1L3.2 9.2l6.1-.8z"
        fill={filled ? 'var(--color-sun)' : 'none'}
        stroke={filled ? '#d99a0f' : 'var(--color-line)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Stars({ count, max = 3, className, size }: { count: number; max?: number; className?: string; size?: string }) {
  const t = useT();
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={t('common.starsOf', { count, max })}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} filled={i < count} className={size} />
      ))}
    </span>
  );
}
