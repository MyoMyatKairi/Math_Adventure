/**
 * Streak, daily goal and practice rules. The server (`private.advance_streak`,
 * `private.streak_state`, `private.daily_goal`, `public.start_review`) enforces
 * the same numbers.
 */
export const STREAK_RULES = {
  /** A freeze is earned on every multiple of this many days in a row. */
  freezeEvery: 7,
  maxFreezes: 2,
} as const;

/** Sessions (lessons or practice rounds) to finish each day. */
export const DAILY_GOAL_SESSIONS = 2;

/** Questions in one practice round. */
export const PRACTICE_SIZE = 5;

export interface StreakRecord {
  current: number;
  longest: number;
  /** UTC day as yyyy-mm-dd, or null before the first session. */
  lastActiveDay: string | null;
  freezes: number;
}

export interface StreakAdvance {
  next: StreakRecord;
  /** True when today is newly counted. */
  extended: boolean;
  freezesUsed: number;
  freezeEarned: boolean;
}

const DAY_MS = 86_400_000;
const dayNumber = (isoDay: string) => Math.round(Date.parse(`${isoDay}T00:00:00Z`) / DAY_MS);

/** Records a finished session on `today`. Mirrors `private.advance_streak`. */
export function advanceStreak(s: StreakRecord, today: string): StreakAdvance {
  let { current, freezes } = s;
  let extended = false;
  let freezesUsed = 0;
  if (s.lastActiveDay === null) {
    current = 1;
    extended = true;
  } else {
    const gap = dayNumber(today) - dayNumber(s.lastActiveDay);
    if (gap <= 0) {
      // today already counted
    } else if (gap - 1 <= freezes) {
      freezesUsed = gap - 1;
      freezes -= freezesUsed;
      current += 1;
      extended = true;
    } else {
      current = 1;
      extended = true;
    }
  }
  let freezeEarned = false;
  if (extended && current % STREAK_RULES.freezeEvery === 0 && freezes < STREAK_RULES.maxFreezes) {
    freezes += 1;
    freezeEarned = true;
  }
  if (!extended) return { next: s, extended, freezesUsed, freezeEarned };
  return {
    next: { current, longest: Math.max(s.longest, current), lastActiveDay: today, freezes },
    extended,
    freezesUsed,
    freezeEarned,
  };
}

/**
 * The streak a learner sees today: alive while every missed day since the last
 * active day can be covered by a freeze. Mirrors `private.streak_state`.
 */
export function visibleStreak(s: StreakRecord, today: string): number {
  if (s.lastActiveDay === null) return 0;
  const missed = dayNumber(today) - dayNumber(s.lastActiveDay) - 1;
  return missed <= s.freezes ? s.current : 0;
}
