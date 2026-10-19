import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-display font-bold rounded-2xl transition-[transform,box-shadow,background-color] select-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[2px]',
  {
    variants: {
      variant: {
        primary: 'bg-lagoon text-white shadow-[0_4px_0_0_var(--color-lagoon-dark)] hover:bg-lagoon-dark active:shadow-none',
        secondary: 'bg-paper text-ink border-2 border-line shadow-[0_3px_0_0_var(--color-line)] hover:border-ink-soft active:shadow-none',
        sun: 'bg-sun text-ink shadow-[0_4px_0_0_#d99a0f] hover:brightness-95 active:shadow-none',
        ghost: 'text-ink-soft hover:bg-white/70 hover:text-ink',
        danger: 'bg-ember-dark text-white shadow-[0_4px_0_0_#6e3507] hover:brightness-110 active:shadow-none',
        link: 'text-lagoon-dark underline underline-offset-4 hover:text-ink rounded-md',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-base',
        lg: 'h-14 px-7 text-lg',
        xl: 'h-16 px-8 text-xl',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin', className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
