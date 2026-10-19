import type { ReactNode } from 'react';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-ink-soft">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
