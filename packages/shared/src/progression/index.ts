import { z } from 'zod';
import { REWARD_RULES } from '../scoring/rewards';

// ---------------------------------------------------------------------------
// Worlds
// ---------------------------------------------------------------------------

export interface WorldProgressInput {
  id: string;
  displayOrder: number;
  lessonCount: number;
  completedCount: number;
}

export function lessonsNeededToUnlockNext(lessonCount: number): number {
  return Math.ceil(lessonCount * REWARD_RULES.worldUnlockFraction);
}

/**
 * The first world of a level is always open. Each later world opens once
 * the learner has completed half (rounded up) of the previous world's lessons.
 * Mirrors `public.ma_world_unlocked`.
 */
export function unlockedWorldIds(worlds: WorldProgressInput[]): Set<string> {
  const sorted = [...worlds].sort((a, b) => a.displayOrder - b.displayOrder);
  const open = new Set<string>();
  sorted.forEach((w, i) => {
    const prev = sorted[i - 1];
    if (i === 0 || (prev && open.has(prev.id) && prev.completedCount >= lessonsNeededToUnlockNext(prev.lessonCount))) {
      open.add(w.id);
    }
  });
  return open;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export const badgeRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lessons_completed'), count: z.number().int().positive() }),
  z.object({ type: z.literal('total_stars'), count: z.number().int().positive() }),
  z.object({ type: z.literal('perfect_lessons'), count: z.number().int().positive() }),
  z.object({ type: z.literal('worlds_completed'), count: z.number().int().positive() }),
  z.object({ type: z.literal('daily_challenges'), count: z.number().int().positive() }),
]);
export type BadgeRule = z.infer<typeof badgeRuleSchema>;

export interface LearnerStats {
  lessonsCompleted: number;
  totalStars: number;
  /** Lessons with a 3-star best result. */
  perfectLessons: number;
  worldsCompleted: number;
  dailyChallenges: number;
}

/** Mirrors `public.ma_badge_earned`. */
export function isBadgeEarned(rule: BadgeRule, stats: LearnerStats): boolean {
  switch (rule.type) {
    case 'lessons_completed':
      return stats.lessonsCompleted >= rule.count;
    case 'total_stars':
      return stats.totalStars >= rule.count;
    case 'perfect_lessons':
      return stats.perfectLessons >= rule.count;
    case 'worlds_completed':
      return stats.worldsCompleted >= rule.count;
    case 'daily_challenges':
      return stats.dailyChallenges >= rule.count;
  }
}

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  iconKey: string;
  rule: BadgeRule;
}

export const BADGES: BadgeDefinition[] = [
  { key: 'first-steps', title: 'First Steps', description: 'Finished your first lesson.', iconKey: 'footprints', rule: { type: 'lessons_completed', count: 1 } },
  { key: 'curious-explorer', title: 'Curious Explorer', description: 'Finished 5 lessons.', iconKey: 'compass', rule: { type: 'lessons_completed', count: 5 } },
  { key: 'math-adventurer', title: 'Math Adventurer', description: 'Finished 15 lessons.', iconKey: 'map', rule: { type: 'lessons_completed', count: 15 } },
  { key: 'star-collector', title: 'Star Collector', description: 'Collected 10 stars.', iconKey: 'star', rule: { type: 'total_stars', count: 10 } },
  { key: 'super-star', title: 'Super Star', description: 'Collected 30 stars.', iconKey: 'sparkles', rule: { type: 'total_stars', count: 30 } },
  { key: 'perfect-score', title: 'Perfect Score', description: 'Earned 3 stars in a lesson.', iconKey: 'trophy', rule: { type: 'perfect_lessons', count: 1 } },
  { key: 'sharp-thinker', title: 'Sharp Thinker', description: 'Earned 3 stars in 5 lessons.', iconKey: 'brain', rule: { type: 'perfect_lessons', count: 5 } },
  { key: 'world-explorer', title: 'World Explorer', description: 'Finished every lesson in a world.', iconKey: 'globe', rule: { type: 'worlds_completed', count: 1 } },
  { key: 'daily-practice', title: 'Daily Practice', description: 'Finished 3 daily challenges.', iconKey: 'calendar', rule: { type: 'daily_challenges', count: 3 } },
  { key: 'daily-hero', title: 'Daily Hero', description: 'Finished 10 daily challenges.', iconKey: 'medal', rule: { type: 'daily_challenges', count: 10 } },
];

// ---------------------------------------------------------------------------
// Topic accuracy and recommendations
// ---------------------------------------------------------------------------

export interface TopicResponseStats {
  topicId: string;
  topicTitle: string;
  /** Questions answered at least once. */
  questionsAnswered: number;
  /** Questions answered correctly on the first try. */
  firstTryCorrect: number;
  lessonsCompleted: number;
  lessonCount: number;
}

export type TopicStatus = 'not_started' | 'needs_practice' | 'growing' | 'confident';

export interface TopicSummary extends TopicResponseStats {
  accuracy: number | null;
  status: TopicStatus;
  /** Neutral, encouraging description for parents. */
  message: string;
}

/** Minimum answered questions before an accuracy-based label is shown. */
export const MIN_RESPONSES_FOR_LABEL = 5;

export function summarizeTopic(stats: TopicResponseStats): TopicSummary {
  const name = stats.topicTitle.toLowerCase();
  if (stats.questionsAnswered === 0) {
    return { ...stats, accuracy: null, status: 'not_started', message: `Not started ${name} yet.` };
  }
  const accuracy = Math.round((stats.firstTryCorrect * 100) / stats.questionsAnswered);
  if (stats.questionsAnswered < MIN_RESPONSES_FOR_LABEL) {
    return { ...stats, accuracy, status: 'growing', message: `Just getting started with ${name}.` };
  }
  if (accuracy < 60) {
    return { ...stats, accuracy, status: 'needs_practice', message: `Practise ${name} again.` };
  }
  if (accuracy < 85) {
    return { ...stats, accuracy, status: 'growing', message: `Getting more confident with ${name}.` };
  }
  return { ...stats, accuracy, status: 'confident', message: `Confident with ${name}.` };
}

export function summarizeTopics(rows: TopicResponseStats[]): TopicSummary[] {
  return rows.map(summarizeTopic);
}

/** Topics worth revisiting, most in need first. */
export function topicsToPractise(summaries: TopicSummary[]): TopicSummary[] {
  return summaries
    .filter((s) => s.status === 'needs_practice')
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
}

export function overallAccuracy(rows: Pick<TopicResponseStats, 'questionsAnswered' | 'firstTryCorrect'>[]): number | null {
  const answered = rows.reduce((n, r) => n + r.questionsAnswered, 0);
  if (answered === 0) return null;
  return Math.round((rows.reduce((n, r) => n + r.firstTryCorrect, 0) * 100) / answered);
}

export interface MapLesson {
  id: string;
  worldId: string;
  displayOrder: number;
  status: 'not_started' | 'in_progress' | 'completed';
  bestStars: number;
}

/**
 * Next lesson to suggest: an in-progress lesson first, then the first unfinished
 * lesson in an open world, then the lowest-star completed lesson for review.
 */
export function recommendLesson(
  worlds: { id: string; displayOrder: number; unlocked: boolean }[],
  lessons: MapLesson[],
): MapLesson | null {
  const worldOrder = new Map(worlds.map((w) => [w.id, w.displayOrder]));
  const open = new Set(worlds.filter((w) => w.unlocked).map((w) => w.id));
  const available = lessons
    .filter((l) => open.has(l.worldId))
    .sort((a, b) => (worldOrder.get(a.worldId)! - worldOrder.get(b.worldId)!) || a.displayOrder - b.displayOrder);
  return (
    available.find((l) => l.status === 'in_progress') ??
    available.find((l) => l.status === 'not_started') ??
    [...available].sort((a, b) => a.bestStars - b.bestStars)[0] ??
    null
  );
}
