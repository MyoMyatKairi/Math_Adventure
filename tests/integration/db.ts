/**
 * Database test harness. Connects straight to the local Supabase Postgres and
 * impersonates the `anon` and `authenticated` roles exactly as PostgREST does
 * (SET ROLE + request.jwt.claims), so RLS policies, column grants and RPCs are
 * exercised for real. Each test runs inside a transaction that is rolled back.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll } from 'vitest';

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 6 });
afterAll(async () => {
  await pool.end();
});

export type Actor = { kind: 'anon' } | { kind: 'user'; id: string } | { kind: 'service' };
export const anon: Actor = { kind: 'anon' };
export const user = (id: string): Actor => ({ kind: 'user', id });

export class DbError extends Error {
  constructor(
    message: string,
    public code: string | undefined,
  ) {
    super(message);
  }
}

export class Tx {
  private sp = 0;
  constructor(public client: pg.PoolClient) {}

  /** Runs SQL as the given actor. Failures roll back to a savepoint so the test can continue. */
  async as<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
    const name = `sp_${++this.sp}`;
    await this.client.query(`savepoint ${name}`);
    try {
      if (actor.kind === 'anon') {
        await this.client.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
        await this.client.query('set local role anon');
      } else if (actor.kind === 'user') {
        const claims = JSON.stringify({ sub: actor.id, role: 'authenticated', aud: 'authenticated' });
        await this.client.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
        await this.client.query('set local role authenticated');
      }
      const res = await this.client.query(sql, params);
      await this.client.query('reset role');
      await this.client.query(`release savepoint ${name}`);
      return res.rows as T[];
    } catch (e) {
      await this.client.query(`rollback to savepoint ${name}`);
      await this.client.query('reset role');
      const err = e as pg.DatabaseError;
      throw new DbError(err.message, err.code);
    }
  }

  /** Superuser query, for setup and for reading answer keys in tests. */
  async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.client.query(sql, params)).rows as T[];
  }

  async rpc<T = unknown>(actor: Actor, fn: string, args: Record<string, unknown>): Promise<T> {
    const names = Object.keys(args);
    const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as result`;
    const rows = await this.as<{ result: T }>(actor, sql, Object.values(args));
    return rows[0]!.result;
  }

  async createParent(name = 'Test Parent'): Promise<string> {
    const id = randomUUID();
    await this.admin(
      `insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(), now())`,
      [id, `parent-${id}@example.test`, JSON.stringify({ display_name: name, role: 'admin' })],
    );
    return id;
  }

  async createChild(parentId: string, levelId = LEVEL_1, name = 'Robin'): Promise<string> {
    const rows = await this.as<{ id: string }>(
      user(parentId),
      `insert into public.child_profiles (display_name, avatar_key, age_group, learning_level_id)
       values ($1, 'fox', '5-7', $2) returning id`,
      [name, levelId],
    );
    return rows[0]!.id;
  }
}

export const LEVEL_1 = '00000000-0000-4000-8000-000000000001';
export const LEVEL_2 = '00000000-0000-4000-8000-000000000002';

/** Runs `fn` in a transaction that is always rolled back. */
export async function withTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await fn(new Tx(client));
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

/** For tests that need real commits (concurrency). Caller must clean up. */
export async function connect(): Promise<pg.PoolClient> {
  return pool.connect();
}

export interface LessonRow {
  id: string;
  world_id: string;
  difficulty: number;
}

/** Lessons of a level in map order (world order, then lesson order). */
export async function lessonsForLevel(tx: Tx, levelId: string): Promise<LessonRow[]> {
  return tx.admin<LessonRow>(
    `select l.id, l.world_id, l.difficulty from public.lessons l join public.worlds w on w.id = l.world_id
     where w.learning_level_id = $1 order by w.display_order, l.display_order`,
    [levelId],
  );
}

export async function answerKey(tx: Tx, questionId: string): Promise<{ type: string; value: string; options: { id: string }[] | null }> {
  const [row] = await tx.admin<{ question_type: string; answer_data: { value: string }; options: { id: string }[] | null }>(
    'select question_type, answer_data, options from public.questions where id = $1',
    [questionId],
  );
  return { type: row!.question_type, value: row!.answer_data.value, options: row!.options };
}

/** A definitely-wrong but valid answer for a question. */
export function wrongAnswer(key: { type: string; value: string; options: { id: string }[] | null }): string {
  if (key.type === 'multiple_choice') return key.options!.find((o) => o.id !== key.value)!.id;
  if (key.type === 'compare') return key.value === '<' ? '>' : '<';
  return key.value === '999' ? '998' : '999';
}

export interface StartResult {
  attemptId: string;
  resumed: boolean;
  questions: { id: string; type: string }[];
  progress: { questionId: string; resolved: boolean }[];
}

/** Plays a whole lesson. `plan[i]` is 'right', 'wrong-right' or 'wrong-wrong'. */
export async function playLesson(
  tx: Tx,
  parent: string,
  child: string,
  lessonId: string,
  plan: ('right' | 'wrong-right' | 'wrong-wrong')[] | 'all-right' = 'all-right',
  daily = false,
) {
  const start = await tx.rpc<StartResult>(user(parent), 'start_lesson', { p_child_id: child, p_lesson_id: lessonId, p_daily: daily });
  for (const [i, q] of start.questions.entries()) {
    const step = plan === 'all-right' ? 'right' : plan[i] ?? 'right';
    const key = await answerKey(tx, q.id);
    const answers = step === 'right' ? [key.value] : step === 'wrong-right' ? [wrongAnswer(key), key.value] : [wrongAnswer(key), wrongAnswer(key)];
    for (const a of answers) {
      await tx.rpc(user(parent), 'submit_answer', { p_attempt_id: start.attemptId, p_question_id: q.id, p_answer: a });
    }
  }
  return tx.rpc<Record<string, unknown>>(user(parent), 'complete_lesson', { p_attempt_id: start.attemptId });
}
