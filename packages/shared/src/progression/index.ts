import { z } from 'zod';
import type { Locale, TranslatedLocale } from '../i18n/locales';
import { translate, type MessageKey } from '../i18n/translate';
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
  /** Burmese and Thai text, seeded into badges.translations. */
  translations: Record<TranslatedLocale, { title: string; description: string }>;
}

export const BADGES: BadgeDefinition[] = [
  {
    key: 'first-steps', title: 'First Steps', description: 'Finished your first lesson.', iconKey: 'footprints', rule: { type: 'lessons_completed', count: 1 },
    translations: { my: { title: 'ပထမခြေလှမ်း', description: 'ပထမဆုံး သင်ခန်းစာကို ပြီးခဲ့သည်။' }, th: { title: 'ก้าวแรก', description: 'ทำบทเรียนแรกจบแล้ว' } },
  },
  {
    key: 'curious-explorer', title: 'Curious Explorer', description: 'Finished 5 lessons.', iconKey: 'compass', rule: { type: 'lessons_completed', count: 5 },
    translations: { my: { title: 'စူးစမ်းချင်သော ခရီးသည်', description: 'သင်ခန်းစာ ၅ ခု ပြီးခဲ့သည်။' }, th: { title: 'นักสำรวจขี้สงสัย', description: 'ทำบทเรียนจบ 5 บท' } },
  },
  {
    key: 'math-adventurer', title: 'Math Adventurer', description: 'Finished 15 lessons.', iconKey: 'map', rule: { type: 'lessons_completed', count: 15 },
    translations: { my: { title: 'သင်္ချာ စွန့်စားသူ', description: 'သင်ခန်းစာ ၁၅ ခု ပြီးခဲ့သည်။' }, th: { title: 'นักผจญภัยคณิตศาสตร์', description: 'ทำบทเรียนจบ 15 บท' } },
  },
  {
    key: 'star-collector', title: 'Star Collector', description: 'Collected 10 stars.', iconKey: 'star', rule: { type: 'total_stars', count: 10 },
    translations: { my: { title: 'ကြယ်စုဆောင်းသူ', description: 'ကြယ် ၁၀ ပွင့် စုဆောင်းခဲ့သည်။' }, th: { title: 'นักสะสมดาว', description: 'สะสมดาวได้ 10 ดวง' } },
  },
  {
    key: 'super-star', title: 'Super Star', description: 'Collected 30 stars.', iconKey: 'sparkles', rule: { type: 'total_stars', count: 30 },
    translations: { my: { title: 'စူပါစတား', description: 'ကြယ် ၃၀ ပွင့် စုဆောင်းခဲ့သည်။' }, th: { title: 'ซูเปอร์สตาร์', description: 'สะสมดาวได้ 30 ดวง' } },
  },
  {
    key: 'perfect-score', title: 'Perfect Score', description: 'Earned 3 stars in a lesson.', iconKey: 'trophy', rule: { type: 'perfect_lessons', count: 1 },
    translations: { my: { title: 'အမှတ်ပြည့်', description: 'သင်ခန်းစာတစ်ခုတွင် ကြယ် ၃ ပွင့် ရခဲ့သည်။' }, th: { title: 'คะแนนเต็ม', description: 'ได้ 3 ดาวในหนึ่งบทเรียน' } },
  },
  {
    key: 'sharp-thinker', title: 'Sharp Thinker', description: 'Earned 3 stars in 5 lessons.', iconKey: 'brain', rule: { type: 'perfect_lessons', count: 5 },
    translations: { my: { title: 'ဉာဏ်ထက်သူ', description: 'သင်ခန်းစာ ၅ ခုတွင် ကြယ် ၃ ပွင့်စီ ရခဲ့သည်။' }, th: { title: 'นักคิดหัวไว', description: 'ได้ 3 ดาวใน 5 บทเรียน' } },
  },
  {
    key: 'world-explorer', title: 'World Explorer', description: 'Finished every lesson in a world.', iconKey: 'globe', rule: { type: 'worlds_completed', count: 1 },
    translations: { my: { title: 'ကမ္ဘာ့ခရီးသည်', description: 'ကမ္ဘာတစ်ခုရှိ သင်ခန်းစာအားလုံး ပြီးခဲ့သည်။' }, th: { title: 'นักสำรวจโลก', description: 'ทำบทเรียนในโลกหนึ่งครบทุกบท' } },
  },
  {
    key: 'daily-practice', title: 'Daily Practice', description: 'Finished 3 daily challenges.', iconKey: 'calendar', rule: { type: 'daily_challenges', count: 3 },
    translations: { my: { title: 'နေ့စဉ်လေ့ကျင့်သူ', description: 'နေ့စဉ်စိန်ခေါ်မှု ၃ ခု ပြီးခဲ့သည်။' }, th: { title: 'ฝึกทุกวัน', description: 'ทำภารกิจประจำวันจบ 3 ครั้ง' } },
  },
  {
    key: 'daily-hero', title: 'Daily Hero', description: 'Finished 10 daily challenges.', iconKey: 'medal', rule: { type: 'daily_challenges', count: 10 },
    translations: { my: { title: 'နေ့စဉ် သူရဲကောင်း', description: 'နေ့စဉ်စိန်ခေါ်မှု ၁၀ ခု ပြီးခဲ့သည်။' }, th: { title: 'ฮีโร่ประจำวัน', description: 'ทำภารกิจประจำวันจบ 10 ครั้ง' } },
  },
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

export function summarizeTopic(stats: TopicResponseStats, locale: Locale = 'en'): TopicSummary {
  // English reads the topic name mid-sentence ("Practise fractions again."); other scripts have no case.
  const topic = locale === 'en' ? stats.topicTitle.toLowerCase() : stats.topicTitle;
  const message = (key: MessageKey) => translate(locale, key, { topic });
  if (stats.questionsAnswered === 0) {
    return { ...stats, accuracy: null, status: 'not_started', message: message('topic.notStarted') };
  }
  const accuracy = Math.round((stats.firstTryCorrect * 100) / stats.questionsAnswered);
  if (stats.questionsAnswered < MIN_RESPONSES_FOR_LABEL) {
    return { ...stats, accuracy, status: 'growing', message: message('topic.justStarted') };
  }
  if (accuracy < 60) {
    return { ...stats, accuracy, status: 'needs_practice', message: message('topic.practise') };
  }
  if (accuracy < 85) {
    return { ...stats, accuracy, status: 'growing', message: message('topic.growing') };
  }
  return { ...stats, accuracy, status: 'confident', message: message('topic.confident') };
}

export function summarizeTopics(rows: TopicResponseStats[], locale: Locale = 'en'): TopicSummary[] {
  return rows.map((r) => summarizeTopic(r, locale));
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
