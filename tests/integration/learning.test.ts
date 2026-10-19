import { describe, expect, it } from 'vitest';
import { calculateLessonRewards, lessonScorePercent, questionPointsAwarded, starsForScore, unlockedWorldIds } from '@math-adventure/shared';
import {
  answerKey,
  connect,
  lessonsForLevel,
  LEVEL_1,
  LEVEL_2,
  playLesson,
  user,
  withTx,
  wrongAnswer,
  type StartResult,
} from './db';

type Summary = {
  score: number;
  stars: number;
  bestStars: number;
  xpAwarded: number;
  starsAwarded: number;
  correctAnswers: number;
  totalQuestions: number;
  dailyBonusXp: number;
  alreadyCompleted: boolean;
  newBadges: { key: string }[];
  unlockedWorlds: { id: string }[];
};

const totals = async (tx: Parameters<Parameters<typeof withTx>[0]>[0], child: string) => {
  const [r] = await tx.admin<{ xp: number; stars: number }>(
    'select coalesce(sum(xp_awarded),0)::int as xp, coalesce(sum(stars_awarded),0)::int as stars from public.reward_events where child_profile_id = $1',
    [child],
  );
  return r!;
};

describe('lesson flow', () => {
  it('answers, feedback, completion, progress and rewards', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const start = await tx.rpc<StartResult>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      expect(start.questions).toHaveLength(5);
      expect(start.resumed).toBe(false);

      const [q1, q2] = start.questions;
      const k1 = await answerKey(tx, q1!.id);

      // Wrong first try: hint, no explanation yet, one try left.
      const wrong = await tx.rpc<Record<string, unknown>>(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q1!.id, p_answer: wrongAnswer(k1) });
      expect(wrong).toMatchObject({ status: 'answered', isCorrect: false, triesRemaining: 1, resolved: false, explanation: null, correctAnswer: null });
      // Second try correct: half points, explanation shown.
      const right = await tx.rpc<Record<string, unknown>>(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q1!.id, p_answer: k1.value });
      expect(right).toMatchObject({ isCorrect: true, resolved: true, pointsAwarded: 5 });
      expect(typeof right.explanation).toBe('string');
      // A resolved question cannot be answered again.
      await expect(tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q1!.id, p_answer: k1.value })).rejects.toThrow(/question_already_answered/);

      // Two wrong answers: reveal the correct answer, no points.
      const k2 = await answerKey(tx, q2!.id);
      await tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q2!.id, p_answer: wrongAnswer(k2) });
      const out = await tx.rpc<Record<string, unknown>>(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q2!.id, p_answer: wrongAnswer(k2) });
      expect(out).toMatchObject({ isCorrect: false, resolved: true, triesRemaining: 0, pointsAwarded: 0 });
      expect(out.correctAnswer).toBeTruthy();
      await expect(tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q2!.id, p_answer: k2.value })).rejects.toThrow(/question_already_answered/);

      // Cannot complete early.
      await expect(tx.rpc(user(parent), 'complete_lesson', { p_attempt_id: start.attemptId })).rejects.toThrow(/attempt_incomplete/);

      // Resume returns the same attempt and progress.
      const resumed = await tx.rpc<StartResult>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      expect(resumed.attemptId).toBe(start.attemptId);
      expect(resumed.resumed).toBe(true);
      expect(resumed.progress.filter((p) => p.resolved)).toHaveLength(2);

      for (const q of start.questions.slice(2)) {
        const k = await answerKey(tx, q.id);
        await tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: k.value });
      }
      const summary = await tx.rpc<Summary>(user(parent), 'complete_lesson', { p_attempt_id: start.attemptId });

      // Server result matches the shared reward rules exactly.
      const earned = questionPointsAwarded(10, 2) + questionPointsAwarded(10, null) + 3 * questionPointsAwarded(10, 1);
      const score = lessonScorePercent(earned, 50);
      const expected = calculateLessonRewards({ difficulty: lesson!.difficulty, scorePercent: score, previousBestStars: 0, isFirstCompletion: true, isDailyChallenge: false, dailyAlreadyClaimed: false });
      expect(summary).toMatchObject({ score, stars: starsForScore(score), correctAnswers: 3, totalQuestions: 5, xpAwarded: expected.totalXp, starsAwarded: expected.newStars, alreadyCompleted: false });
      expect(summary.newBadges.map((b) => b.key)).toContain('first-steps');

      const [progress] = await tx.as<{ status: string; best_score: number; best_stars: number; attempts_count: number }>(
        user(parent),
        'select status, best_score, best_stars, attempts_count from public.lesson_progress where child_profile_id = $1',
        [child],
      );
      expect(progress).toEqual({ status: 'completed', best_score: score, best_stars: starsForScore(score), attempts_count: 1 });
    }));

  it('invalid input does not use up a try and is never evaluated', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const start = await tx.rpc<StartResult>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      const numericQ = start.questions.find((q) => q.type !== 'multiple_choice' && q.type !== 'compare' && q.type !== 'visual_quantity') ?? start.questions[0]!;
      for (const bad of ['', 'abc', '2+2', '1/0', "1'; drop table public.lessons; --", 'x'.repeat(41)]) {
        const r = await tx.rpc<{ status: string }>(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: numericQ.id, p_answer: bad });
        expect(r.status, bad).toBe('invalid');
      }
      const [{ n }] = (await tx.admin<{ n: number }>('select count(*)::int as n from public.question_responses where quiz_attempt_id = $1', [start.attemptId])) as [{ n: number }];
      expect(n).toBe(0);
      expect((await tx.admin('select id from public.lessons')).length).toBe(45);
    }));

  it('rejects questions that are not part of the attempt', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [l1, l2] = await lessonsForLevel(tx, LEVEL_1);
      const start = await tx.rpc<StartResult>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: l1!.id });
      const [other] = await tx.admin<{ id: string }>('select id from public.questions where lesson_id = $1 limit 1', [l2!.id]);
      await expect(tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: other!.id, p_answer: '1' })).rejects.toThrow(/question_not_in_attempt/);
    }));
});

describe('idempotent rewards', () => {
  it('duplicate completion requests and replays cannot farm XP', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const first = (await playLesson(tx, parent, child, lesson!.id)) as unknown as Summary;
      expect(first.stars).toBe(3);
      const after1 = await totals(tx, child);
      expect(after1).toEqual({ xp: 10 + 10 * lesson!.difficulty + 15, stars: 3 });

      // Same attempt submitted again: same summary, nothing new.
      const [attempt] = await tx.admin<{ id: string }>('select id from public.quiz_attempts where child_profile_id = $1', [child]);
      const again = await tx.rpc<Summary>(user(parent), 'complete_lesson', { p_attempt_id: attempt!.id });
      expect(again).toMatchObject({ alreadyCompleted: true, xpAwarded: first.xpAwarded });
      expect(await totals(tx, child)).toEqual(after1);

      // Replaying the lesson perfectly earns nothing more.
      const replay = (await playLesson(tx, parent, child, lesson!.id)) as unknown as Summary;
      expect(replay).toMatchObject({ xpAwarded: 0, starsAwarded: 0, stars: 3, bestStars: 3 });
      expect(await totals(tx, child)).toEqual(after1);
    }));

  it('improving a score earns only the newly reached stars', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const low = (await playLesson(tx, parent, child, lesson!.id, ['wrong-wrong', 'wrong-wrong', 'wrong-wrong', 'right', 'right'])) as unknown as Summary;
      expect(low.stars).toBe(1);
      const high = (await playLesson(tx, parent, child, lesson!.id)) as unknown as Summary;
      expect(high).toMatchObject({ stars: 3, starsAwarded: 2, xpAwarded: 10 });
      // A worse later attempt never lowers the best result.
      const worse = (await playLesson(tx, parent, child, lesson!.id, ['wrong-wrong', 'wrong-wrong', 'wrong-wrong', 'wrong-wrong', 'wrong-wrong'])) as unknown as Summary;
      expect(worse).toMatchObject({ stars: 1, bestStars: 3, xpAwarded: 0 });
      expect((await totals(tx, child)).stars).toBe(3);
    }));

  it('concurrent completion requests award rewards once', async () => {
    const setup = await connect();
    let parentId = '';
    try {
      // Committed setup so two independent connections can race.
      const { Tx } = await import('./db');
      const tx = new Tx(setup);
      await setup.query('begin');
      parentId = await tx.createParent();
      const child = await tx.createChild(parentId);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const start = await tx.rpc<StartResult>(user(parentId), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      for (const q of start.questions) {
        const k = await answerKey(tx, q.id);
        await tx.rpc(user(parentId), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: k.value });
      }
      await setup.query('commit');
      const call = async () => {
        const c = await connect();
        try {
          await c.query('begin');
          await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: parentId, role: 'authenticated' })]);
          await c.query('set local role authenticated');
          const r = await c.query('select public.complete_lesson($1) as s', [start.attemptId]);
          await c.query('commit');
          return r.rows[0].s as Summary;
        } finally {
          c.release();
        }
      };
      const results = await Promise.all([call(), call(), call()]);
      expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
      const [r] = (await setup.query('select count(*)::int as n, sum(xp_awarded)::int as xp from public.reward_events where child_profile_id = $1', [child])).rows;
      expect(r.n).toBe(4); // completion + 3 stars
      expect(r.xp).toBe(10 + 10 * lesson!.difficulty + 15);
    } finally {
      if (parentId) await setup.query('delete from auth.users where id = $1', [parentId]);
      setup.release();
    }
  });
});

describe('worlds, levels and daily challenges', () => {
  it('locks later worlds until half the previous world is complete', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const lessons = await lessonsForLevel(tx, LEVEL_1);
      const worldIds = [...new Set(lessons.map((l) => l.world_id))];
      const firstWorld = lessons.filter((l) => l.world_id === worldIds[0]);
      const secondWorldLesson = lessons.find((l) => l.world_id === worldIds[1])!;

      await expect(tx.rpc(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: secondWorldLesson.id })).rejects.toThrow(/world_locked/);

      const needed = Math.ceil(firstWorld.length / 2);
      let last: Summary | undefined;
      for (const l of firstWorld.slice(0, needed)) last = (await playLesson(tx, parent, child, l.id)) as unknown as Summary;
      expect(last!.unlockedWorlds.map((w) => w.id)).toEqual([worldIds[1]]);

      // Server and shared rules agree on the unlocked set.
      const overview = await tx.rpc<{ worlds: { id: string; displayOrder: number; lessonCount: number; completedCount: number; unlocked: boolean }[] }>(
        user(parent),
        'get_learner_overview',
        { p_child_id: child },
      );
      const shared = unlockedWorldIds(overview.worlds);
      expect(overview.worlds.filter((w) => w.unlocked).map((w) => w.id).sort()).toEqual([...shared].sort());
      await tx.rpc(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: secondWorldLesson.id });
    }));

  it("lessons from another level are not available until the parent changes the child's level", () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [l2] = await lessonsForLevel(tx, LEVEL_2);
      await expect(tx.rpc(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: l2!.id })).rejects.toThrow(/lesson_not_available/);
      await tx.as(user(parent), `update public.child_profiles set learning_level_id = $1, age_group = '8-10' where id = $2`, [LEVEL_2, child]);
      await tx.rpc(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: l2!.id });
    }));

  it('daily challenge gives a bonus once per day, with no penalty for missing days', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const lessons = await lessonsForLevel(tx, LEVEL_1);
      const overview = await tx.rpc<{ daily: { lessonId: string; completed: boolean; bonusXp: number } }>(user(parent), 'get_learner_overview', { p_child_id: child });
      expect(overview.daily.completed).toBe(false);
      const other = lessons.find((l) => l.id !== overview.daily.lessonId)!;
      await expect(tx.rpc(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: other.id, p_daily: true })).rejects.toThrow(/not_daily_challenge/);

      const first = (await playLesson(tx, parent, child, overview.daily.lessonId, 'all-right', true)) as unknown as Summary;
      expect(first.dailyBonusXp).toBe(15);
      const second = (await playLesson(tx, parent, child, overview.daily.lessonId, 'all-right', true)) as unknown as Summary;
      expect(second.dailyBonusXp).toBe(0);
      const after = await tx.rpc<{ daily: { completed: boolean } }>(user(parent), 'get_learner_overview', { p_child_id: child });
      expect(after.daily.completed).toBe(true);
    }));
});

describe('parent reports', () => {
  it('reports real activity only, with topic accuracy from first tries', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      type Report = {
        stats: { lessonsCompleted: number };
        recentActivity: unknown[];
        weekly: { lessonsCompleted: number; questionsAnswered: number }[];
        topics: { topicId: string; questionsAnswered: number; firstTryCorrect: number; lessonsCompleted: number }[];
      };
      const empty = await tx.rpc<Report>(user(parent), 'get_child_report', { p_child_id: child });
      expect(empty.stats.lessonsCompleted).toBe(0);
      expect(empty.recentActivity).toEqual([]);
      expect(empty.weekly).toHaveLength(7);
      expect(empty.weekly.every((d) => d.lessonsCompleted === 0 && d.questionsAnswered === 0)).toBe(true);
      expect(empty.topics.every((t) => t.questionsAnswered === 0)).toBe(true);

      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      await playLesson(tx, parent, child, lesson!.id, ['wrong-right', 'right', 'wrong-wrong', 'right', 'right']);
      const report = await tx.rpc<Report>(user(parent), 'get_child_report', { p_child_id: child });
      const [{ topic_id }] = (await tx.admin<{ topic_id: string }>('select topic_id from public.lessons where id = $1', [lesson!.id])) as [{ topic_id: string }];
      const topic = report.topics.find((t) => t.topicId === topic_id)!;
      expect(topic).toMatchObject({ questionsAnswered: 5, firstTryCorrect: 3, lessonsCompleted: 1 });
      expect(report.recentActivity).toHaveLength(1);
      expect(report.weekly.at(-1)).toMatchObject({ lessonsCompleted: 1, questionsAnswered: 5 });

      const overview = await tx.rpc<{ id: string; stats: { lessonsCompleted: number } }[]>(user(parent), 'get_parent_overview', {});
      expect(overview).toHaveLength(1);
      expect(overview[0]!.stats.lessonsCompleted).toBe(1);
    }));

  it('progress survives deletion only as far as the parent wants: deleting a child removes its records', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      await playLesson(tx, parent, child, lesson!.id);
      await tx.as(user(parent), 'delete from public.child_profiles where id = $1', [child]);
      for (const table of ['lesson_progress', 'quiz_attempts', 'reward_events', 'child_badges']) {
        expect(await tx.admin(`select 1 from public.${table} where child_profile_id = $1`, [child])).toEqual([]);
      }
    }));
});
