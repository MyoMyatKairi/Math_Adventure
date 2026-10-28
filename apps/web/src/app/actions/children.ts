'use server';

import { childProfileInputSchema, fieldErrors } from '@math-adventure/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { ACTIVE_CHILD_COOKIE, clearActiveChild, setActiveChild } from '@/lib/learner';
import { requireParentArea } from '@/lib/parent-area';
import { lockParentArea } from '@/lib/parent-gate';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from './auth';

function readChild(fd: FormData) {
  return childProfileInputSchema.safeParse({
    displayName: fd.get('displayName'),
    avatarKey: fd.get('avatarKey'),
    ageGroup: fd.get('ageGroup'),
    learningLevelId: fd.get('learningLevelId'),
  });
}

export async function createChildAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireParentArea();
  const parsed = readChild(fd);
  const locale = await getLocale();
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error, locale) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('child_profiles')
    .insert({
      display_name: parsed.data.displayName,
      avatar_key: parsed.data.avatarKey,
      age_group: parsed.data.ageGroup,
      learning_level_id: parsed.data.learningLevelId,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: friendlyError(error, locale) };
  redirect(`/parent?added=${encodeURIComponent(parsed.data.displayName)}`);
}

export async function updateChildAction(childId: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireParentArea();
  const parsed = readChild(fd);
  const locale = await getLocale();
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error, locale) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('child_profiles')
    .update({
      display_name: parsed.data.displayName,
      avatar_key: parsed.data.avatarKey,
      age_group: parsed.data.ageGroup,
      learning_level_id: parsed.data.learningLevelId,
    })
    .eq('id', childId)
    .select('id');
  if (error) return { status: 'error', message: friendlyError(error, locale) };
  if (!data?.length) return { status: 'error', message: friendlyError({ message: 'child_not_found' }, locale) };
  redirect(`/parent/children/${childId}?saved=1`);
}

export async function deleteChildAction(childId: string): Promise<FormState> {
  await requireParentArea();
  const supabase = await createClient();
  const { data, error } = await supabase.from('child_profiles').delete().eq('id', childId).select('display_name');
  const locale = await getLocale();
  if (error) return { status: 'error', message: friendlyError(error, locale) };
  if (!data?.length) return { status: 'error', message: friendlyError({ message: 'child_not_found' }, locale) };
  if ((await cookies()).get(ACTIVE_CHILD_COOKIE)?.value === childId) await clearActiveChild();
  redirect(`/parent?removed=${encodeURIComponent(data[0]!.display_name)}`);
}

/** Switches the device into learner mode for one child and locks the parent area. */
export async function startLearningAction(childId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('child_profiles').select('id').eq('id', childId).is('archived_at', null).maybeSingle();
  if (!data) redirect('/learn?missing=1');
  await setActiveChild(childId);
  await lockParentArea();
  redirect('/learn/home');
}
