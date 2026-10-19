import { friendlyError } from '@math-adventure/shared';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Loads an RPC result with loading/error state and a reload function. */
export function useRpc<T>(fn: string, args: Record<string, unknown> | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(args);

  const load = useCallback(async () => {
    if (!args) return;
    setLoading(true);
    setError(null);
    const { data: d, error: e } = await supabase.rpc(fn, args);
    if (e) setError(friendlyError(e));
    else setData(d as T);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}
