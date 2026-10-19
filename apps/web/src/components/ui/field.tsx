import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-xl border-2 border-line bg-paper px-4 text-base text-ink placeholder:text-ink-soft/60 focus:border-plum focus:outline-none aria-[invalid=true]:border-ember',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-soft">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-ember-dark" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const styles = {
    error: 'bg-ember-soft text-ember-dark border-ember/40',
    success: 'bg-lagoon-soft text-lagoon-dark border-lagoon/40',
    info: 'bg-sky-soft text-ink border-sky/40',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm font-medium', styles)}>
      {children}
    </div>
  );
}
