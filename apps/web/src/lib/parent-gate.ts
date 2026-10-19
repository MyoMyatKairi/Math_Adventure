import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * The parent area is locked while a child is learning. Unlocking needs the
 * parent's password; the unlock is a signed, short-lived, httpOnly cookie.
 */
const COOKIE = 'ma_parent_gate';
const TTL_SECONDS = 30 * 60;

let devSecret: string | undefined;
function secret(): string {
  const s = process.env.PARENT_GATE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PARENT_GATE_SECRET must be set (32+ characters) in production.');
  }
  devSecret ??= randomBytes(32).toString('hex');
  return devSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export async function unlockParentArea(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function lockParentArea() {
  (await cookies()).delete(COOKIE);
}

export async function isParentAreaUnlocked(userId: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [uid, exp, sig] = parts as [string, string, string];
  if (uid !== userId || Number(exp) < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(`${uid}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
