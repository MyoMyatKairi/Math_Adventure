import { describe, expect, it } from 'vitest';
import {
  BADGES,
  calculateLessonRewards,
  completionXp,
  isBadgeEarned,
  lessonScorePercent,
  questionPointsAwarded,
  recommendLesson,
  starsForScore,
  summarizeTopic,
  unlockedWorldIds,
  xpLevel,
} from '../src';

describe('scoring', () => {
  it('awards full, half or no points', () => {
    expect(questionPointsAwarded(10, 1)).toBe(10);
    expect(questionPointsAwarded(10, 2)).toBe(5);
    expect(questionPointsAwarded(5, 2)).toBe(2);
    expect(questionPointsAwarded(10, null)).toBe(0);
  });
  it('computes percentages with clamping', () => {
    expect(lessonScorePercent(45, 50)).toBe(90);
    expect(lessonScorePercent(1, 3)).toBe(33);
    expect(lessonScorePercent(2, 3)).toBe(67);
    expect(lessonScorePercent(0, 0)).toBe(0);
    expect(lessonScorePercent(99, 50)).toBe(100);
  });
  it('maps scores to stars at the boundaries', () => {
    expect(starsForScore(100)).toBe(3);
    expect(starsForScore(90)).toBe(3);
    expect(starsForScore(89)).toBe(2);
    expect(starsForScore(70)).toBe(2);
    expect(starsForScore(69)).toBe(1);
    expect(starsForScore(0)).toBe(1);
  });
  it('scales completion XP by difficulty', () => {
    expect(completionXp(1)).toBe(20);
    expect(completionXp(3)).toBe(40);
    expect(completionXp(99)).toBe(40);
  });
});

describe('calculateLessonRewards', () => {
  const base = { difficulty: 2, scorePercent: 100, previousBestStars: 0, isFirstCompletion: true, isDailyChallenge: false, dailyAlreadyClaimed: false };
  it('first perfect completion', () => {
    expect(calculateLessonRewards(base)).toMatchObject({ stars: 3, newStars: 3, totalXp: 30 + 15 });
  });
  it('replaying a completed lesson with the same result earns nothing (no XP farming)', () => {
    const r = calculateLessonRewards({ ...base, previousBestStars: 3, isFirstCompletion: false });
    expect(r.totalXp).toBe(0);
    expect(r.newStars).toBe(0);
  });
  it('improving from 1 to 3 stars earns only the new stars', () => {
    const r = calculateLessonRewards({ ...base, previousBestStars: 1, isFirstCompletion: false });
    expect(r).toMatchObject({ newStars: 2, completionXp: 0, starXp: 10, totalXp: 10 });
  });
  it('a worse replay never removes stars', () => {
    const r = calculateLessonRewards({ ...base, scorePercent: 10, previousBestStars: 3, isFirstCompletion: false });
    expect(r.newStars).toBe(0);
  });
  it('daily bonus only once', () => {
    expect(calculateLessonRewards({ ...base, isDailyChallenge: true }).dailyXp).toBe(15);
    expect(calculateLessonRewards({ ...base, isDailyChallenge: true, dailyAlreadyClaimed: true }).dailyXp).toBe(0);
  });
});

describe('world unlocking', () => {
  const worlds = [
    { id: 'w1', displayOrder: 1, lessonCount: 6, completedCount: 0 },
    { id: 'w2', displayOrder: 2, lessonCount: 6, completedCount: 0 },
    { id: 'w3', displayOrder: 3, lessonCount: 3, completedCount: 0 },
  ];
  it('opens only the first world for a new learner', () => {
    expect([...unlockedWorldIds(worlds)]).toEqual(['w1']);
  });
  it('opens the next world at half the lessons', () => {
    expect(unlockedWorldIds([{ ...worlds[0]!, completedCount: 2 }, worlds[1]!, worlds[2]!]).has('w2')).toBe(false);
    expect(unlockedWorldIds([{ ...worlds[0]!, completedCount: 3 }, worlds[1]!, worlds[2]!]).has('w2')).toBe(true);
  });
  it('does not skip a locked world even if later progress exists', () => {
    const open = unlockedWorldIds([worlds[0]!, { ...worlds[1]!, completedCount: 6 }, worlds[2]!]);
    expect(open.has('w3')).toBe(false);
  });
});

describe('badges', () => {
  const stats = { lessonsCompleted: 0, totalStars: 0, perfectLessons: 0, worldsCompleted: 0, dailyChallenges: 0 };
  const badge = (key: string) => BADGES.find((b) => b.key === key)!.rule;
  it('first lesson badge', () => {
    expect(isBadgeEarned(badge('first-steps'), stats)).toBe(false);
    expect(isBadgeEarned(badge('first-steps'), { ...stats, lessonsCompleted: 1 })).toBe(true);
  });
  it('star thresholds are inclusive', () => {
    expect(isBadgeEarned(badge('star-collector'), { ...stats, totalStars: 9 })).toBe(false);
    expect(isBadgeEarned(badge('star-collector'), { ...stats, totalStars: 10 })).toBe(true);
  });
  it('badge keys are unique', () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
  });
});

describe('topic summaries use neutral language', () => {
  const row = { topicId: 't', topicTitle: 'Fractions', lessonsCompleted: 1, lessonCount: 3 };
  it('labels', () => {
    expect(summarizeTopic({ ...row, questionsAnswered: 0, firstTryCorrect: 0 }).message).toBe('Not started fractions yet.');
    expect(summarizeTopic({ ...row, questionsAnswered: 10, firstTryCorrect: 4 }).message).toBe('Practise fractions again.');
    expect(summarizeTopic({ ...row, questionsAnswered: 10, firstTryCorrect: 7 }).message).toBe('Getting more confident with fractions.');
    expect(summarizeTopic({ ...row, questionsAnswered: 10, firstTryCorrect: 9 }).status).toBe('confident');
  });
  it('never uses negative labels', () => {
    for (let c = 0; c <= 10; c++) {
      const m = summarizeTopic({ ...row, questionsAnswered: 10, firstTryCorrect: c }).message.toLowerCase();
      expect(m).not.toMatch(/fail|bad|poor|weak|struggl|unintelligent/);
    }
  });
});

describe('recommendLesson', () => {
  const worlds = [
    { id: 'w1', displayOrder: 1, unlocked: true },
    { id: 'w2', displayOrder: 2, unlocked: false },
  ];
  it('prefers in-progress, then not started, in map order', () => {
    const lessons = [
      { id: 'a', worldId: 'w1', displayOrder: 1, status: 'completed' as const, bestStars: 3 },
      { id: 'b', worldId: 'w1', displayOrder: 2, status: 'not_started' as const, bestStars: 0 },
      { id: 'c', worldId: 'w2', displayOrder: 1, status: 'in_progress' as const, bestStars: 0 },
    ];
    expect(recommendLesson(worlds, lessons)?.id).toBe('b');
  });
  it('suggests review of lowest stars when all done', () => {
    const lessons = [
      { id: 'a', worldId: 'w1', displayOrder: 1, status: 'completed' as const, bestStars: 3 },
      { id: 'b', worldId: 'w1', displayOrder: 2, status: 'completed' as const, bestStars: 1 },
    ];
    expect(recommendLesson(worlds, lessons)?.id).toBe('b');
  });
});

describe('xpLevel', () => {
  it('levels up on a growing curve', () => {
    expect(xpLevel(0)).toEqual({ level: 1, intoLevel: 0, levelSize: 100 });
    expect(xpLevel(100)).toEqual({ level: 2, intoLevel: 0, levelSize: 200 });
    expect(xpLevel(350)).toEqual({ level: 3, intoLevel: 50, levelSize: 300 });
  });
});
