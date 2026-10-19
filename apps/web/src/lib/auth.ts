import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';

/** The signed-in parent, verified with the auth server (not just the cookie). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/sign-in');
  return user;
}
