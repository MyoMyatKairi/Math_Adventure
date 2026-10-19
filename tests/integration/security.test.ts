import { describe, expect, it } from 'vitest';
import { anon, DbError, lessonsForLevel, LEVEL_1, playLesson, user, withTx } from './db';

const expectDenied = async (p: Promise<unknown>, pattern: RegExp = /permission denied|row-level security|child_not_found|attempt_not_found|not_authenticated/) => {
  await expect(p).rejects.toThrow(pattern);
};

describe('accounts and roles', () => {
  it('creates a parent profile on sign-up and ignores a client-supplied role', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent('Alex');
      const [p] = await tx.as<{ role: string; display_name: string }>(user(parent), 'select role, display_name from public.profiles');
      expect(p).toEqual({ role: 'parent', display_name: 'Alex' });
    }));

  it('a parent cannot grant themselves admin', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      await expectDenied(tx.as(user(parent), `update public.profiles set role = 'admin' where id = $1`, [parent]));
      await tx.as(user(parent), `update public.profiles set display_name = 'New name' where id = $1`, [parent]);
      const [p] = await tx.admin<{ role: string; display_name: string }>('select role, display_name from public.profiles where id = $1', [parent]);
      expect(p).toEqual({ role: 'parent', display_name: 'New name' });
    }));

  it("a parent cannot read another parent's profile", () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      const b = await tx.createParent();
      expect(await tx.as(user(b), 'select * from public.profiles where id = $1', [a])).toEqual([]);
    }));
});

describe('child profile isolation', () => {
  it("parent B cannot read, update, delete or learn as parent A's child", () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      const b = await tx.createParent();
      const child = await tx.createChild(a);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);

      expect(await tx.as(user(b), 'select * from public.child_profiles')).toEqual([]);
      expect(await tx.as(user(b), `update public.child_profiles set display_name = 'Hacked' where id = $1 returning id`, [child])).toEqual([]);
      expect(await tx.as(user(b), 'delete from public.child_profiles where id = $1 returning id', [child])).toEqual([]);
      await expectDenied(tx.rpc(user(b), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id }));
      await expectDenied(tx.rpc(user(b), 'get_learner_overview', { p_child_id: child }));
      await expectDenied(tx.rpc(user(b), 'get_child_report', { p_child_id: child }));

      const [row] = await tx.admin<{ display_name: string }>('select display_name from public.child_profiles where id = $1', [child]);
      expect(row!.display_name).toBe('Robin');
    }));

  it('a parent cannot create a child under another parent', () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      const b = await tx.createParent();
      await expectDenied(
        tx.as(
          user(b),
          `insert into public.child_profiles (parent_id, display_name, avatar_key, age_group, learning_level_id)
           values ($1, 'Sneaky', 'fox', '5-7', $2)`,
          [a, LEVEL_1],
        ),
      );
    }));

  it("parent B cannot see parent A's attempts, responses, rewards or badges", () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      const b = await tx.createParent();
      const child = await tx.createChild(a);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      await playLesson(tx, a, child, lesson!.id);

      for (const table of ['lesson_progress', 'quiz_attempts', 'question_responses', 'reward_events', 'child_badges']) {
        expect((await tx.as(user(a), `select * from public.${table}`)).length, `${table} visible to owner`).toBeGreaterThan(0);
        expect(await tx.as(user(b), `select * from public.${table}`), `${table} hidden from other parent`).toEqual([]);
      }
      const [attempt] = await tx.as<{ id: string }>(user(a), 'select id from public.quiz_attempts');
      await expectDenied(tx.rpc(user(b), 'complete_lesson', { p_attempt_id: attempt!.id }));
    }));

  it('validates child profile values with constraints', () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      const insert = (name: string, avatar: string, age: string) =>
        tx.as(
          user(a),
          `insert into public.child_profiles (display_name, avatar_key, age_group, learning_level_id) values ($1, $2, $3, $4)`,
          [name, avatar, age, LEVEL_1],
        );
      await expect(insert('', 'fox', '5-7')).rejects.toThrow(/check constraint/);
      await expect(insert('Kid', 'dragon', '5-7')).rejects.toThrow(/check constraint/);
      await expect(insert('Kid', 'fox', '4-6')).rejects.toThrow(/check constraint/);
      await expect(insert('x'.repeat(31), 'fox', '5-7')).rejects.toThrow(/check constraint/);
    }));

  it('limits a parent to 8 learner profiles', () =>
    withTx(async (tx) => {
      const a = await tx.createParent();
      for (let i = 0; i < 8; i++) await tx.createChild(a, LEVEL_1, `Kid ${String.fromCharCode(65 + i)}`);
      await expect(tx.createChild(a, LEVEL_1, 'Ninth')).rejects.toThrow(/child_limit_reached/);
    }));
});

describe('anonymous and curriculum access', () => {
  it('anonymous visitors see published curriculum but no private data', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      await tx.createChild(parent);
      expect((await tx.as(anon, 'select id from public.lessons')).length).toBe(45);
      expect((await tx.as(anon, 'select id from public.worlds')).length).toBe(9);
      expect((await tx.as(anon, 'select id from public.badges')).length).toBe(10);
      for (const table of ['child_profiles', 'profiles', 'lesson_progress', 'quiz_attempts', 'question_responses', 'reward_events', 'child_badges', 'questions']) {
        await expectDenied(tx.as(anon, `select * from public.${table}`));
      }
      await expectDenied(tx.rpc(anon, 'get_parent_overview', {}));
    }));

  it('unpublished lessons are hidden', () =>
    withTx(async (tx) => {
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      await tx.admin('update public.lessons set is_published = false where id = $1', [lesson!.id]);
      expect(await tx.as(anon, 'select id from public.lessons where id = $1', [lesson!.id])).toEqual([]);
    }));

  it('answer keys are never readable by parents or visitors', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      expect(await tx.as(user(parent), 'select answer_data from public.questions')).toEqual([]);
      await expectDenied(tx.as(anon, 'select answer_data from public.questions'));
    }));

  it('lesson payloads from start_lesson contain no answers or explanations', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      const res = await tx.rpc<{ questions: Record<string, unknown>[] }>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lesson!.id });
      for (const q of res.questions) {
        expect(Object.keys(q).sort()).toEqual(['answerFormat', 'difficulty', 'hint', 'id', 'options', 'points', 'prompt', 'type', 'visual']);
      }
      const keys = await tx.admin<{ answer_data: unknown; explanation: string }>('select answer_data, explanation from public.questions where lesson_id = $1', [lesson!.id]);
      const payload = JSON.stringify(res);
      for (const k of keys) {
        expect(payload).not.toContain(JSON.stringify(k.answer_data));
        expect(payload).not.toContain(k.explanation);
      }
    }));

  it('only admins can write curriculum', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const [lesson] = await lessonsForLevel(tx, LEVEL_1);
      expect(await tx.as(user(parent), `update public.lessons set title = 'Hacked' where id = $1 returning id`, [lesson!.id])).toEqual([]);
      await tx.admin(`update public.profiles set role = 'admin' where id = $1`, [parent]);
      expect(await tx.as(user(parent), `update public.lessons set title = 'Edited' where id = $1 returning id`, [lesson!.id])).toHaveLength(1);
      expect((await tx.as(user(parent), 'select answer_data from public.questions limit 1')).length).toBe(1);
    }));

  it('learners cannot write learning records directly', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      const child = await tx.createChild(parent);
      await expectDenied(
        tx.as(user(parent), `insert into public.reward_events (child_profile_id, source_type, source_id, idempotency_key, xp_awarded) values ($1, 'lesson_star', $1, 'x', 9999)`, [child]),
      );
      await expectDenied(tx.as(user(parent), `update public.lesson_progress set best_stars = 3`));
      await expectDenied(tx.as(user(parent), `insert into public.child_badges (child_profile_id, badge_id) select $1, id from public.badges limit 1`, [child]));
    }));

  it('private helper functions are not callable by clients', () =>
    withTx(async (tx) => {
      const parent = await tx.createParent();
      await expectDenied(tx.as(user(parent), `select private.check_answer('numeric', '{"value":"1"}', null, '1')`));
      await expectDenied(tx.as(user(parent), `select public.debug_check_answer('numeric', '{"value":"1"}', null, '1')`));
    }));
});
