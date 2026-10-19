import {
  Brain,
  Calendar,
  Compass,
  Footprints,
  Globe,
  Map,
  Medal,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BADGE_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  compass: Compass,
  map: Map,
  star: Star,
  sparkles: Sparkles,
  trophy: Trophy,
  brain: Brain,
  globe: Globe,
  calendar: Calendar,
  medal: Medal,
};

export function BadgeMedal({ iconKey, earned, className }: { iconKey: string; earned: boolean; className?: string }) {
  const Icon = BADGE_ICONS[iconKey] ?? Medal;
  return (
    <span
      className={cn(
        'inline-flex h-14 w-14 items-center justify-center rounded-full border-4',
        earned ? 'border-sun bg-sun-soft text-sun-dark' : 'border-line bg-chalk text-ink-soft/50',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="h-7 w-7" strokeWidth={2.2} />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-extrabold text-ink', className)}>
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <path d="M6 30c6-14 22-2 28-18" fill="none" stroke="var(--color-lagoon)" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 7" />
        <circle cx="6" cy="30" r="5" fill="var(--color-plum)" />
        <path d="M34 4l2.2 4.6 5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.4 5-.7z" fill="var(--color-sun)" stroke="#d99a0f" strokeWidth="1" />
      </svg>
      Math Adventure
    </span>
  );
}

/** Small illustrated emblem for each world theme. */
export function WorldEmblem({ themeKey, locked, className }: { themeKey: string; locked?: boolean; className?: string }) {
  const art = WORLD_ART[themeKey] ?? WORLD_ART.forest;
  return (
    // width/height attributes keep the size when nested inside another SVG, where CSS classes don't apply.
    <svg viewBox="0 0 80 80" width="80" height="80" className={cn('h-20 w-20', locked && 'grayscale opacity-60', className)} aria-hidden="true">
      {art}
    </svg>
  );
}

const WORLD_ART: Record<string, React.ReactNode> = {
  forest: (
    <>
      <circle cx="40" cy="40" r="38" fill="#dcf5e4" />
      <path d="M26 58V46M54 58V42" stroke="#7a5230" strokeWidth="4" />
      <path d="M26 20l-12 22h24zM26 30l-14 20h28z" fill="#2f9a5b" />
      <path d="M54 16l-13 24h26zM54 26l-15 22h30z" fill="#3fb36b" />
      <path d="M8 60h64" stroke="#2f9a5b" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  village: (
    <>
      <circle cx="40" cy="40" r="38" fill="#fff3d6" />
      <path d="M14 42l14-12 14 12v18H14z" fill="#e8781e" />
      <path d="M38 46l12-10 12 10v14H38z" fill="#4f8fe8" />
      <rect x="24" y="48" width="8" height="12" fill="#1c2541" />
      <rect x="46" y="50" width="7" height="10" fill="#1c2541" />
      <path d="M8 60h64" stroke="#c9771a" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  meadow: (
    <>
      <circle cx="40" cy="40" r="38" fill="#eee9fd" />
      <circle cx="26" cy="36" r="9" fill="none" stroke="#7c5ce0" strokeWidth="4" />
      <rect x="40" y="26" width="16" height="16" fill="none" stroke="#0e9f94" strokeWidth="4" />
      <path d="M33 60l9-14 9 14z" fill="none" stroke="#e8781e" strokeWidth="4" strokeLinejoin="round" />
    </>
  ),
  mountain: (
    <>
      <circle cx="40" cy="40" r="38" fill="#e3eefc" />
      <path d="M6 62l22-36 14 22 8-12 24 26z" fill="#6b7ba3" />
      <path d="M28 26l-6 10 6-3 6 3z" fill="#fff" />
      <text x="50" y="30" fontSize="16" fontWeight="800" fill="#1c2541" fontFamily="system-ui">×</text>
    </>
  ),
  ocean: (
    <>
      <circle cx="40" cy="40" r="38" fill="#dcf5f2" />
      <path d="M6 46c6-5 11-5 17 0s11 5 17 0 11-5 17 0 11 5 17 0v24H6z" fill="#4f8fe8" />
      <path d="M22 38a12 12 0 0 1 24 0z" fill="#ffc23d" />
      <path d="M34 26v12" stroke="#1c2541" strokeWidth="2" />
    </>
  ),
  city: (
    <>
      <circle cx="40" cy="40" r="38" fill="#fdeee0" />
      <rect x="14" y="30" width="14" height="32" fill="#4a5578" />
      <rect x="32" y="18" width="16" height="44" fill="#1c2541" />
      <rect x="52" y="34" width="14" height="28" fill="#4a5578" />
      <circle cx="40" cy="30" r="6" fill="#fff" />
      <path d="M40 30v-4M40 30h3" stroke="#1c2541" strokeWidth="1.5" />
    </>
  ),
  lagoon: (
    <>
      <circle cx="40" cy="40" r="38" fill="#dcf5f2" />
      <ellipse cx="40" cy="54" rx="30" ry="10" fill="#0e9f94" />
      <path d="M40 54V26" stroke="#7a5230" strokeWidth="4" />
      <path d="M40 26c-10-6-18-2-20 4M40 26c10-6 18-2 20 4M40 26c-4-8-2-14 2-16" stroke="#2f9a5b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <text x="14" y="30" fontSize="12" fontWeight="800" fill="#1c2541" fontFamily="system-ui">%</text>
    </>
  ),
  ice: (
    <>
      <circle cx="40" cy="40" r="38" fill="#e3eefc" />
      <path d="M10 60l14-20 10 8 12-22 24 34z" fill="#fff" stroke="#9fb3d1" strokeWidth="2" />
      <text x="16" y="30" fontSize="16" fontWeight="800" fill="#4f8fe8" fontFamily="system-ui">−5</text>
    </>
  ),
  galaxy: (
    <>
      <circle cx="40" cy="40" r="38" fill="#1c2541" />
      <circle cx="40" cy="42" r="12" fill="#7c5ce0" />
      <ellipse cx="40" cy="42" rx="22" ry="6" fill="none" stroke="#ffc23d" strokeWidth="3" transform="rotate(-15 40 42)" />
      <circle cx="18" cy="18" r="1.5" fill="#fff" />
      <circle cx="62" cy="22" r="1.2" fill="#fff" />
      <circle cx="58" cy="62" r="1.5" fill="#fff" />
    </>
  ),
};
