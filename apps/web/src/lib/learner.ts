import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type { LearnerOverview } from './types';

/** Which child is learning on this device. RLS still decides whether the parent may see it. */
export const ACTIVE_CHILD_COOKIE = 'ma_child';

export async function setActiveChild(childId: string) {
  (await cookies()).set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearActiveChild() {
  (await cookies()).delete(ACTIVE_CHILD_COOKIE);
}

/** Loads the active learner's overview, or sends the user to pick a profile. */
export const requireLearner = cache(async (): Promise<LearnerOverview> => {
  const childId = (await cookies()).get(ACTIVE_CHILD_COOKIE)?.value;
  if (!childId) redirect('/learn');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_learner_overview', { p_child_id: childId });
  if (error || !data) redirect('/learn');
  return data as LearnerOverview;
});
