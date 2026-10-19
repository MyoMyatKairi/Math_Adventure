import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { unlockParentArea } from '@/lib/parent-gate';
import { createClient } from '@/lib/supabase/server';

/** Handles email confirmation and password-reset links (PKCE code or token hash). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get('next') ?? '/parent';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/parent';
  const supabase = await createClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error('missing code') };

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/sign-in?error=link`);
  }
  await unlockParentArea(data.user.id);
  return NextResponse.redirect(`${origin}${next}`);
}
