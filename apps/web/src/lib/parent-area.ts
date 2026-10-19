import 'server-only';
import { redirect } from 'next/navigation';
import { requireUser } from './auth';
import { isParentAreaUnlocked } from './parent-gate';

/** Signed-in parent who has unlocked the parent area on this device. */
export async function requireParentArea(next = '/parent') {
  const user = await requireUser();
  if (!(await isParentAreaUnlocked(user.id))) redirect(`/parent-gate?next=${encodeURIComponent(next)}`);
  return user;
}
