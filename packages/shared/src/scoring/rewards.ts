/**
 * Central reward rules. The server (`public.complete_lesson`) enforces the same
 * numbers; tests/integration/rewards-parity.test.ts checks they agree.
 */
export const REWARD_RULES = {
  maxTriesPerQuestion: 2,
  /** Share of a question's points earned when correct on the second try. */
  secondTryPointFactor: 0.5,
  starThresholds: { three: 90, two: 70 },
  completionXpBase: 10,
  completionXpPerDifficulty: 10,
  xpPerNewStar: 5,
  dailyChallengeXp: 15,
  /** Fraction of a world's lessons to complete before the next world opens. */
  worldUnlockFraction: 0.5,
} as const;

/** Points for one question. `correctOnTry` is 1 or 2, or null if never answered correctly. */
export function questionPointsAwarded(points: number, correctOnTry: number | null): number {
  if (correctOnTry === 1) return points;
  if (correctOnTry === 2) return Math.floor(points * REWARD_RULES.secondTryPointFactor);
  return 0;
}

/** Whole-number percentage, rounded half up. */
export function lessonScorePercent(earnedPoints: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  const clamped = Math.min(Math.max(earnedPoints, 0), maxPoints);
  return Math.floor((clamped * 100) / maxPoints + 0.5);
}

/** Completing a lesson always earns at least one star. */
export function starsForScore(scorePercent: number): 1 | 2 | 3 {
  if (scorePercent >= REWARD_RULES.starThresholds.three) return 3;
  if (scorePercent >= REWARD_RULES.starThresholds.two) return 2;
  return 1;
}

export function completionXp(difficulty: number): number {
  const d = Math.min(Math.max(Math.round(difficulty), 1), 3);
  return REWARD_RULES.completionXpBase + REWARD_RULES.completionXpPerDifficulty * d;
}

export interface LessonRewardInput {
  difficulty: number;
  scorePercent: number;
  /** Best star count before this attempt (0 if never completed). */
  previousBestStars: number;
  isFirstCompletion: boolean;
  isDailyChallenge: boolean;
  dailyAlreadyClaimed: boolean;
}

export interface LessonReward {
  stars: 1 | 2 | 3;
  newStars: number;
  completionXp: number;
  starXp: number;
  dailyXp: number;
  totalXp: number;
}

/**
 * Rewards are idempotent per lesson: completion XP once, each star once,
 * daily bonus once per day. Replaying a lesson can only add stars not yet earned.
 */
export function calculateLessonRewards(input: LessonRewardInput): LessonReward {
  const stars = starsForScore(input.scorePercent);
  const newStars = Math.max(0, stars - input.previousBestStars);
  const cXp = input.isFirstCompletion ? completionXp(input.difficulty) : 0;
  const sXp = newStars * REWARD_RULES.xpPerNewStar;
  const dXp = input.isDailyChallenge && !input.dailyAlreadyClaimed ? REWARD_RULES.dailyChallengeXp : 0;
  return { stars, newStars, completionXp: cXp, starXp: sXp, dailyXp: dXp, totalXp: cXp + sXp + dXp };
}

/** Idempotency keys used for reward_events. One reward per key per child, ever. */
export const rewardKeys = {
  lessonCompletion: (lessonId: string) => `lesson:${lessonId}:complete`,
  lessonStar: (lessonId: string, star: number) => `lesson:${lessonId}:star:${star}`,
  dailyChallenge: (isoDate: string) => `daily:${isoDate}`,
};

/** Simple level curve for display: each level needs 100 XP more than the last. */
export function xpLevel(totalXp: number): { level: number; intoLevel: number; levelSize: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let size = 100;
  while (remaining >= size) {
    remaining -= size;
    level += 1;
    size += 100;
  }
  return { level, intoLevel: remaining, levelSize: size };
}
