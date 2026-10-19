/**
 * End-to-end API tests through the real Supabase stack (GoTrue + PostgREST),
 * using supabase-js exactly as the web and mobile apps do.
 * Requires `supabase start`. Skipped automatically if the API is unreachable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const LEVEL_1 = '00000000-0000-4000-8000-000000000001';

let available = false;
beforeAll(async () => {
  try {
    const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY } });
    available = r.ok;
  } catch {
    available = false;
  }
});

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function newParent(): Promise<{ sb: SupabaseClient; email: string; password: string; id: string }> {
  const sb = client();
  const email = `parent-${randomUUID()}@example.test`;
  const password = 'Adventure123';
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: 'Pat', role: 'admin' } } });
  if (error) throw error;
  return { sb, email, password, id: data.user!.id };
}

describe('API: auth and ownership via supabase-js', () => {
  it('registers, signs out and signs back in', async (ctx) => {
    if (!available) ctx.skip();
    const p = await newParent();
    const { data: profile } = await p.sb.from('profiles').select('display_name, role').single();
    expect(profile).toEqual({ display_name: 'Pat', role: 'parent' });
    await p.sb.auth.signOut();
    const again = client();
    const { error } = await again.auth.signInWithPassword({ email: p.email, password: p.password });
    expect(error).toBeNull();
    const bad = await client().auth.signInWithPassword({ email: p.email, password: 'wrong-password1' });
    expect(bad.error).not.toBeNull();
  });

  it("creates a child, learns, and keeps it private from other parents", async (ctx) => {
    if (!available) ctx.skip();
    const a = await newParent();
    const b = await newParent();
    const { data: child, error } = await a.sb
      .from('child_profiles')
      .insert({ display_name: 'Robin', avatar_key: 'owl', age_group: '5-7', learning_level_id: LEVEL_1 })
      .select('id')
      .single();
    expect(error).toBeNull();

    const overview = await a.sb.rpc('get_learner_overview', { p_child_id: child!.id });
    expect(overview.error).toBeNull();
    const firstLesson = (overview.data as { worlds: { lessons: { id: string }[] }[] }).worlds[0]!.lessons[0]!.id;

    const start = await a.sb.rpc('start_lesson', { p_child_id: child!.id, p_lesson_id: firstLesson });
    expect(start.error).toBeNull();
    const q = (start.data as { attemptId: string; questions: { id: string; type: string; options: { id: string }[] | null }[] });
    const answer = await a.sb.rpc('submit_answer', { p_attempt_id: q.attemptId, p_question_id: q.questions[0]!.id, p_answer: q.questions[0]!.options?.[0]?.id ?? '1' });
    expect(answer.error).toBeNull();
    expect((answer.data as { status: string }).status).toBe('answered');

    // Parent B sees nothing and cannot act on A's child.
    expect((await b.sb.from('child_profiles').select('*')).data).toEqual([]);
    expect((await b.sb.from('quiz_attempts').select('*')).data).toEqual([]);
    expect((await b.sb.from('question_responses').select('*')).data).toEqual([]);
    expect((await b.sb.rpc('get_learner_overview', { p_child_id: child!.id })).error?.message).toMatch(/child_not_found/);
    expect((await b.sb.rpc('submit_answer', { p_attempt_id: q.attemptId, p_question_id: q.questions[1]!.id, p_answer: '1' })).error?.message).toMatch(/attempt_not_found/);
  });

  it('anonymous clients get curriculum but no private data or answer keys', async (ctx) => {
    if (!available) ctx.skip();
    const anon = client();
    const lessons = await anon.from('lessons').select('id, title');
    expect(lessons.data?.length).toBe(45);
    expect((await anon.from('questions').select('answer_data')).error?.code).toBe('42501');
    expect((await anon.from('child_profiles').select('*')).error?.code).toBe('42501');
    expect((await anon.rpc('start_lesson', { p_child_id: randomUUID(), p_lesson_id: randomUUID() })).error).not.toBeNull();
  });

  it('signed-in parents still cannot read answer keys', async (ctx) => {
    if (!available) ctx.skip();
    const p = await newParent();
    const { data } = await p.sb.from('questions').select('answer_data');
    expect(data).toEqual([]);
  });
});
