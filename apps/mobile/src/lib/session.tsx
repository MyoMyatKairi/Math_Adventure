import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

const CHILD_KEY = 'math-adventure.active-child';
/** The parent area stays open this long after the password is re-entered. */
export const PARENT_UNLOCK_MS = 30 * 60 * 1000;

interface SessionState {
  loading: boolean;
  session: Session | null;
  activeChildId: string | null;
  setActiveChild: (id: string | null) => Promise<void>;
  parentUnlockedUntil: number;
  unlockParent: () => void;
  lockParent: () => void;
  isParentUnlocked: () => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [activeChildId, setChild] = useState<string | null>(null);
  const [parentUnlockedUntil, setUnlockedUntil] = useState(0);

  useEffect(() => {
    let mounted = true;
    Promise.all([supabase.auth.getSession(), SecureStore.getItemAsync(CHILD_KEY).catch(() => null)]).then(([{ data }, child]) => {
      if (!mounted) return;
      setSession(data.session);
      setChild(child);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setActiveChild = useCallback(async (id: string | null) => {
    setChild(id);
    if (id) await SecureStore.setItemAsync(CHILD_KEY, id);
    else await SecureStore.deleteItemAsync(CHILD_KEY);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      activeChildId,
      setActiveChild,
      parentUnlockedUntil,
      unlockParent: () => setUnlockedUntil(Date.now() + PARENT_UNLOCK_MS),
      lockParent: () => setUnlockedUntil(0),
      isParentUnlocked: () => parentUnlockedUntil > Date.now(),
      signOut: async () => {
        await supabase.auth.signOut();
        await setActiveChild(null);
        setUnlockedUntil(0);
      },
    }),
    [loading, session, activeChildId, setActiveChild, parentUnlockedUntil],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
