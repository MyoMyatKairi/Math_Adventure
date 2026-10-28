import type { LearnerOverview } from '@math-adventure/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useLocale } from './i18n';
import { useSession } from './session';
import { useRpc } from './use-rpc';

/** The active learner's overview in the chosen language, refreshed whenever a screen gains focus. */
export function useLearner() {
  const { activeChildId } = useSession();
  const { locale } = useLocale();
  const rpc = useRpc<LearnerOverview>('get_learner_overview', activeChildId ? { p_child_id: activeChildId, p_locale: locale } : null);
  const { reload } = rpc;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return rpc;
}
