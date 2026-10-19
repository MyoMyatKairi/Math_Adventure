'use client';

import { Award, Home, LineChart, Lock, Map, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/learn/home', label: 'Home', icon: Home },
  { href: '/learn/map', label: 'Map', icon: Map },
  { href: '/learn/rewards', label: 'Rewards', icon: Award },
  { href: '/learn/progress', label: 'Progress', icon: LineChart },
];

/** Bottom tab bar on phones, top row on larger screens. */
export function LearnerNav() {
  const path = usePathname();
  return (
    <nav aria-label="Learning" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent">
      <ul className="mx-auto flex max-w-lg justify-around sm:max-w-none sm:justify-start sm:gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href === '/learn/map' && path.startsWith('/learn/world'));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-xs font-bold sm:flex-row sm:gap-2 sm:text-base',
                  active ? 'text-lagoon-dark sm:bg-lagoon-soft' : 'text-ink-soft hover:text-ink',
                )}
              >
                <Icon className="h-6 w-6 sm:h-5 sm:w-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LearnerMenuLinks() {
  return (
    <div className="flex items-center gap-1">
      <Link href="/learn" className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">
        <Users className="h-4 w-4" aria-hidden="true" />
        Switch
      </Link>
      <Link href="/parent-gate?next=/parent" className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">
        <Lock className="h-4 w-4" aria-hidden="true" />
        Grown-ups
      </Link>
    </div>
  );
}
