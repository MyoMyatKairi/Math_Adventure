'use client';

import { Award, Home, LineChart, Lock, Map, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher, useT } from '@/components/i18n';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/learn/home', label: 'nav.home', icon: Home },
  { href: '/learn/map', label: 'nav.map', icon: Map },
  { href: '/learn/rewards', label: 'nav.rewards', icon: Award },
  { href: '/learn/progress', label: 'nav.progress', icon: LineChart },
] as const;

/** Bottom tab bar on phones, top row on larger screens. */
export function LearnerNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent">
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
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LearnerMenuLinks() {
  const t = useT();
  return (
    <div className="flex items-center gap-1">
      <LanguageSwitcher />
      <Link href="/learn" className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">
        <Users className="h-4 w-4" aria-hidden="true" />
        {t('nav.switch')}
      </Link>
      <Link href="/parent-gate?next=/parent" className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">
        <Lock className="h-4 w-4" aria-hidden="true" />
        {t('nav.grownUps')}
      </Link>
    </div>
  );
}
