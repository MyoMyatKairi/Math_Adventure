import { describe, expect, it } from 'vitest';
import { advanceStreak, visibleStreak, type StreakRecord } from '../src';

const fresh: StreakRecord = { current: 0, longest: 0, lastActiveDay: null, freezes: 0 };

/** Plays one session on each listed day, in order. */
function play(days: string[], start: StreakRecord = fresh) {
  return days.reduce((s, d) => advanceStreak(s, d).next, start);
}

describe('streaks', () => {
  it('starts at 1 and counts consecutive days once each', () => {
    const first = advanceStreak(fresh, '2026-10-01');
    expect(first).toMatchObject({ extended: true, next: { current: 1, longest: 1, lastActiveDay: '2026-10-01' } });
    const again = advanceStreak(first.next, '2026-10-01');
    expect(again).toMatchObject({ extended: false, next: first.next });
    expect(play(['2026-10-01', '2026-10-02', '2026-10-03']).current).toBe(3);
  });

  it('crosses month ends', () => {
    expect(play(['2026-10-31', '2026-11-01']).current).toBe(2);
  });

  it('earns a freeze every 7 days, up to 2', () => {
    const week = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`);
    const s7 = play(week.slice(0, 6));
    const day7 = advanceStreak(s7, '2026-10-07');
    expect(day7).toMatchObject({ freezeEarned: true, next: { current: 7, freezes: 1 } });
    expect(advanceStreak({ ...day7.next, current: 13, freezes: 2 }, '2026-10-08').freezeEarned).toBe(false);
  });

  it('uses freezes for missed days and resets when there are not enough', () => {
    const s = { current: 9, longest: 9, lastActiveDay: '2026-10-10', freezes: 2 };
    expect(advanceStreak(s, '2026-10-12')).toMatchObject({ freezesUsed: 1, next: { current: 10, freezes: 1 } });
    expect(advanceStreak(s, '2026-10-13')).toMatchObject({ freezesUsed: 2, next: { current: 10, freezes: 0 } });
    expect(advanceStreak(s, '2026-10-14')).toMatchObject({ freezesUsed: 0, next: { current: 1, freezes: 2, longest: 9 } });
  });

  it('shows the streak while missed days are covered', () => {
    const s = { current: 5, longest: 5, lastActiveDay: '2026-10-10', freezes: 1 };
    expect(visibleStreak(s, '2026-10-10')).toBe(5);
    expect(visibleStreak(s, '2026-10-11')).toBe(5);
    expect(visibleStreak(s, '2026-10-12')).toBe(5);
    expect(visibleStreak(s, '2026-10-13')).toBe(0);
    expect(visibleStreak(fresh, '2026-10-13')).toBe(0);
  });
});
