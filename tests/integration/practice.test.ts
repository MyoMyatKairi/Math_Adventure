import { describe, expect, it } from 'vitest';
import { advanceStreak, DAILY_GOAL_SESSIONS, PRACTICE_SIZE, type StreakRecord } from '@math-adventure/shared';
import { answerKey, lessonsForLevel, LEVEL_1, playLesson, user, withTx, type StartResult, type Tx } from './db';

type Streak = { current: number; longest: number; freezes: number; practicedToday: boolean; week: { date: string; active: boolean }[] };
type Summary = {
  kind: string;
  lessonId: string | null;
  xpAwarded: number;
  starsAwarded: number;
  newBadges: unknown[];
  streak: Streak & { extended: boolean; freezesUsed: number; freezeEarned: boolean };
  dailyGoal: { target: number; done: number };
};
type Overview = { streak: Streak; dailyGoal: { target: number; done: number }; practice: { mistakes: number; available: boolean } };

const overview = (tx: Tx, parent: string, child: string) => tx.rpc<Overview>(user(parent), 'get_learner_overview', { p_child_id: child });

/** Moves the stored streak back in time, as if the last session was `daysAgo` days ago. */
async function rewind(tx: Tx, child: string, daysAgo: number, freezes: number, current: number) {
  await tx.admin(
    `update public.child_streaks
       set last_active_day = (now() at time zone 'utc')::date - $2::int, freezes = $3, current_streak = $4, longest_streak = greatest(longest_streak, $4)
     where child_profile_id = $1`,
    [child, daysAgo, freezes, current],
  );
}

async function playReview(tx: Tx, parent: string, child: string, plan: 'right' | 'wrong' = 'right') {
  const start = await tx.rpc<StartResult & { kind: string }>(user(parent), 'start_review', { p_child_id: child });
  for (const q of start.questions) {
    const k = await answerKey(tx, q.id);
    const answers = plan === 'right' ? [k.value] : ['999', '998'];
    for (const a of answers) await tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: a });
  }
  return { start, summary: await tx.rpc<Summary>(user(parent), 'complete_lesson', { p_attempt_id: start.attemptId }) };
}

describe('streaks and the daily goal', () => {
  it('counts one streak day per UTC day and matches the shared rules', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [l1, l2] = await lessonsForLevel(tx, LEVEL_1);

      const before = await overview(tx, parent, child);
      expect(before.streak).toMatchObject({ current: 0, longest: 0, freezes: 0, practicedToday: false });
      expect(before.streak.week).toHaveLength(7);
      expect(before.dailyGoal).toEqual({ target: DAILY_GOAL_SESSIONS, done: 0 });

      const first = (await playLesson(tx, parent, child, l1!.id)) as unknown as Summary;
      expect(first.streak).toMatchObject({ current: 1, extended: true, practicedToday: true });
      expect(first.streak.week.at(-1)).toMatchObject({ active: true });
      expect(first.dailyGoal.done).toBe(1);

      const second = (await playLesson(tx, parent, child, l2!.id)) as unknown as Summary;
      expect(second.streak).toMatchObject({ current: 1, extended: false });
      expect(second.dailyGoal.done).toBe(2);

      // Yesterday, two missed days covered by freezes, and too many missed days.
      const today = new Date().toISOString().slice(0, 10);
      const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
      for (const [daysAgo, freezes, current] of [[1, 0, 6], [3, 2, 9], [4, 1, 9]] as const) {
        await rewind(tx, child, daysAgo, freezes, current);
        const shared = advanceStreak({ current, longest: current, lastActiveDay: ago(daysAgo), freezes } satisfies StreakRecord, today);
        const s = (await playLesson(tx, parent, child, l1!.id)) as unknown as Summary;
        expect(s.streak, `${daysAgo} days ago`).toMatchObject({
          current: shared.next.current,
          freezes: shared.next.freezes,
          freezesUsed: shared.freezesUsed,
          freezeEarned: shared.freezeEarned,
          extended: true,
        });
      }
    }));

  it('shows a broken streak as 0 until the next session', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [l1] = await lessonsForLevel(tx, LEVEL_1);
      await playLesson(tx, parent, child, l1!.id);
      await rewind(tx, child, 2, 1, 5);
      expect((await overview(tx, parent, child)).streak).toMatchObject({ current: 5, practicedToday: false });
      await rewind(tx, child, 3, 1, 5);
      expect((await overview(tx, parent, child)).streak).toMatchObject({ current: 0, longest: 5 });
    }));
});

describe('practice rounds', () => {
  it('needs a finished lesson, starts with mistakes and never awards XP', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);

      expect((await overview(tx, parent, child)).practice).toEqual({ mistakes: 0, available: false });
      await expect(tx.rpc(user(parent), 'start_review', { p_child_id: child })).rejects.toThrow(/nothing_to_review/);

      await playLesson(tx, parent, child, lesson!.id, ['wrong-wrong', 'right', 'wrong-right', 'right', 'right']);
      // Everything in one test transaction shares now(): date the lesson answers earlier, as in real use.
      await tx.admin(
        `update public.question_responses set answered_at = answered_at - interval '1 hour'
         where quiz_attempt_id in (select id from public.quiz_attempts where child_profile_id = $1)`,
        [child],
      );
      const [{ xp: xpBefore }] = (await tx.admin<{ xp: number }>('select coalesce(sum(xp_awarded),0)::int as xp from public.reward_events where child_profile_id = $1', [child])) as [{ xp: number }];
      expect((await overview(tx, parent, child)).practice).toEqual({ mistakes: 2, available: true });

      const { start, summary } = await playReview(tx, parent, child);
      expect(start.kind).toBe('review');
      expect(start.questions).toHaveLength(PRACTICE_SIZE);
      const mistakes = await tx.admin<{ question_id: string }>(
        `select distinct qr.question_id from public.question_responses qr join public.quiz_attempts a on a.id = qr.quiz_attempt_id
         where a.child_profile_id = $1 and a.kind = 'lesson' and qr.attempt_number = 1 and not qr.is_correct`,
        [child],
      );
      expect(start.questions.slice(0, 2).map((q) => q.id).sort()).toEqual(mistakes.map((m) => m.question_id).sort());

      expect(summary).toMatchObject({ kind: 'review', lessonId: null, xpAwarded: 0, starsAwarded: 0, newBadges: [] });
      expect(summary.dailyGoal.done).toBe(2);
      const [{ xp: xpAfter }] = (await tx.admin<{ xp: number }>('select coalesce(sum(xp_awarded),0)::int as xp from public.reward_events where child_profile_id = $1', [child])) as [{ xp: number }];
      expect(xpAfter).toBe(xpBefore);

      // Fixed mistakes leave the list; lesson progress is untouched.
      expect((await overview(tx, parent, child)).practice).toEqual({ mistakes: 0, available: true });
      const [progress] = await tx.admin<{ attempts_count: number }>('select attempts_count from public.lesson_progress where child_profile_id = $1', [child]);
      expect(progress!.attempts_count).toBe(1);
    }));

  it('resumes an open round and keeps other parents out', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const other = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      await playLesson(tx, parent, child, lesson!.id);

      const a = await tx.rpc<StartResult>(user(parent), 'start_review', { p_child_id: child });
      const b = await tx.rpc<StartResult>(user(parent), 'start_review', { p_child_id: child });
      expect(b).toMatchObject({ attemptId: a.attemptId, resumed: true });

      await expect(tx.rpc(user(other), 'start_review', { p_child_id: child })).rejects.toThrow(/child_not_found/);
      await expect(tx.rpc(user(other), 'complete_lesson', { p_attempt_id: a.attemptId })).rejects.toThrow(/attempt_not_found/);
      expect(await tx.as(user(other), 'select * from public.child_streaks where child_profile_id = $1', [child])).toEqual([]);
      await expect(tx.as(user(parent), 'update public.child_streaks set current_streak = 999 where child_profile_id = $1', [child])).rejects.toThrow(/permission denied/);
    }));
});
