import type { LearnerOverview } from '@math-adventure/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSession } from './session';
import { useRpc } from './use-rpc';

/** The active learner's overview, refreshed whenever a screen gains focus. */
export function useLearner() {
  const { activeChildId } = useSession();
  const rpc = useRpc<LearnerOverview>('get_learner_overview', activeChildId ? { p_child_id: activeChildId } : null);
  const { reload } = rpc;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return rpc;
}
