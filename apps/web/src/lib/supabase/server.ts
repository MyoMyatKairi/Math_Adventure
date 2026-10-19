import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';

/** Supabase client bound to the signed-in parent's session cookies. Never uses the service role. */
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}
