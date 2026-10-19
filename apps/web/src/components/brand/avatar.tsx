import type { AvatarKey } from '@math-adventure/shared';
import { cn } from '@/lib/utils';

const LABEL: Record<AvatarKey, string> = {
  fox: 'Fox',
  owl: 'Owl',
  panda: 'Panda',
  turtle: 'Turtle',
  rocket: 'Rocket',
  robot: 'Robot',
  whale: 'Whale',
  lion: 'Lion',
};
export const avatarLabel = (k: AvatarKey) => LABEL[k];

/** Original, simple avatar illustrations drawn from basic shapes. */
export function Avatar({ avatarKey, className, decorative = true }: { avatarKey: AvatarKey; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-12 w-12 shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : LABEL[avatarKey]}
    >
      {ART[avatarKey]}
    </svg>
  );
}

const eye = (cx: number, cy: number, r = 3.2) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill="#1c2541" />
    <circle cx={cx + 1} cy={cy - 1} r={r / 3} fill="#fff" />
  </>
);

const ART: Record<AvatarKey, React.ReactNode> = {
  fox: (
    <>
      <circle cx="32" cy="32" r="31" fill="#ffe6cc" />
      <path d="M14 14l10 14-12 4zM50 14l-10 14 12 4z" fill="#e8781e" />
      <path d="M12 30c0-10 9-16 20-16s20 6 20 16c0 12-10 22-20 22S12 42 12 30z" fill="#f08a2c" />
      <path d="M20 36c4 0 8 3 12 9 4-6 8-9 12-9-2 9-7 15-12 15s-10-6-12-15z" fill="#fff" />
      {eye(24, 31)}
      {eye(40, 31)}
      <circle cx="32" cy="44" r="2.6" fill="#1c2541" />
    </>
  ),
  owl: (
    <>
      <circle cx="32" cy="32" r="31" fill="#e9e1fb" />
      <path d="M16 18l6 6M48 18l-6 6" stroke="#6d4b2f" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="32" cy="36" rx="18" ry="19" fill="#8a603d" />
      <ellipse cx="32" cy="42" rx="11" ry="11" fill="#d9b48a" />
      <circle cx="24" cy="30" r="7" fill="#fff" />
      <circle cx="40" cy="30" r="7" fill="#fff" />
      {eye(24, 30)}
      {eye(40, 30)}
      <path d="M29 36l3 4 3-4z" fill="#ffc23d" />
    </>
  ),
  panda: (
    <>
      <circle cx="32" cy="32" r="31" fill="#dcf5f2" />
      <circle cx="17" cy="17" r="7" fill="#1c2541" />
      <circle cx="47" cy="17" r="7" fill="#1c2541" />
      <circle cx="32" cy="34" r="19" fill="#fff" stroke="#1c2541" strokeWidth="1.5" />
      <ellipse cx="24" cy="32" rx="5" ry="6.5" fill="#1c2541" transform="rotate(-20 24 32)" />
      <ellipse cx="40" cy="32" rx="5" ry="6.5" fill="#1c2541" transform="rotate(20 40 32)" />
      <circle cx="24.5" cy="31.5" r="1.6" fill="#fff" />
      <circle cx="39.5" cy="31.5" r="1.6" fill="#fff" />
      <ellipse cx="32" cy="41" rx="3" ry="2.2" fill="#1c2541" />
    </>
  ),
  turtle: (
    <>
      <circle cx="32" cy="32" r="31" fill="#fff3d6" />
      <circle cx="50" cy="30" r="6" fill="#7cc96a" />
      {eye(51, 29, 1.6)}
      <ellipse cx="18" cy="44" rx="4" ry="3" fill="#7cc96a" />
      <ellipse cx="42" cy="44" rx="4" ry="3" fill="#7cc96a" />
      <path d="M12 40c0-12 9-20 20-20s20 8 20 20z" fill="#2f9a5b" />
      <path d="M22 26l4 7h12l4-7M26 33l-6 7M38 33l6 7" stroke="#7cc96a" strokeWidth="2" fill="none" />
    </>
  ),
  rocket: (
    <>
      <circle cx="32" cy="32" r="31" fill="#1c2541" />
      <circle cx="14" cy="16" r="1.4" fill="#fff" />
      <circle cx="50" cy="12" r="1" fill="#fff" />
      <circle cx="52" cy="46" r="1.3" fill="#fff" />
      <path d="M32 8c8 6 11 16 9 30H23C21 24 24 14 32 8z" fill="#f2f6fc" />
      <circle cx="32" cy="24" r="5" fill="#4f8fe8" stroke="#1c2541" strokeWidth="1.5" />
      <path d="M23 32l-7 10 8-2zM41 32l7 10-8-2z" fill="#e8781e" />
      <path d="M27 40h10l-5 12z" fill="#ffc23d" />
    </>
  ),
  robot: (
    <>
      <circle cx="32" cy="32" r="31" fill="#e3eefc" />
      <path d="M32 10v7" stroke="#4a5578" strokeWidth="3" />
      <circle cx="32" cy="9" r="3" fill="#e8781e" />
      <rect x="15" y="17" width="34" height="30" rx="8" fill="#9fb3d1" />
      <rect x="20" y="23" width="24" height="13" rx="5" fill="#1c2541" />
      <circle cx="27" cy="29.5" r="3" fill="#0e9f94" />
      <circle cx="37" cy="29.5" r="3" fill="#0e9f94" />
      <path d="M25 41h14" stroke="#1c2541" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  whale: (
    <>
      <circle cx="32" cy="32" r="31" fill="#e3eefc" />
      <path d="M30 14c-2-4-6-4-8-2M30 14c2-4 6-4 8-2M30 14v6" stroke="#4f8fe8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M10 38c0-10 9-16 20-16 12 0 20 7 20 15l6-5-2 9 2 9-6-5c-3 5-10 8-20 8-12 0-20-6-20-15z" fill="#4f8fe8" />
      <path d="M14 42c5 6 20 7 30 0" fill="#cfe1fb" />
      {eye(22, 34)}
    </>
  ),
  lion: (
    <>
      <circle cx="32" cy="32" r="31" fill="#fff3d6" />
      <circle cx="32" cy="32" r="22" fill="#c9771a" />
      <circle cx="32" cy="34" r="15" fill="#ffc23d" />
      {eye(26, 31, 2.6)}
      {eye(38, 31, 2.6)}
      <path d="M29 38h6l-3 3z" fill="#1c2541" />
      <path d="M32 41c-1 2-3 3-5 2M32 41c1 2 3 3 5 2" stroke="#1c2541" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
};
