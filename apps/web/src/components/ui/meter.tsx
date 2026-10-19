import { cn } from '@/lib/utils';

/** Horizontal progress meter with an accessible label. */
export function Meter({
  value,
  max,
  label,
  tone = 'lagoon',
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'lagoon' | 'sun' | 'plum' | 'sky';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = { lagoon: 'bg-lagoon', sun: 'bg-sun', plum: 'bg-plum', sky: 'bg-sky' }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-line/70', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
