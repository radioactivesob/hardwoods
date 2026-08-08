import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, Shot, Drill, BUILT_IN_DRILLS } from './trainingStats';

const STORAGE_KEY = 'hardwoods_training_v1';

// The live session's crash-safe snapshot. Owned by the runner screen;
// the picker reads it to offer "resume".
export const TRAINING_IN_PROGRESS_KEY = 'hardwoods_training_inprogress';

interface TrainingStore {
  sessions: Session[];
  /** Drills imported from a coach; built-ins live in code. */
  drills: Drill[];
  /** Per-kid target overrides, keyed `kidId:drillId`. A drill's shipped
   *  target suits some ages and not others, so each player gets their own. */
  targets: Record<string, number>;
}

const EMPTY: TrainingStore = { sessions: [], drills: [], targets: {} };

const targetKey = (kidId: string, drillId: string) => `${kidId}:${drillId}`;

export function useTraining() {
  const [store, setStore] = useState<TrainingStore>(EMPTY);
  const [loading, setLoading] = useState(true);

  // Each screen holds its own copy of the store, so a screen that stays
  // mounted while another one writes goes stale. Screens showing lists
  // call reload() on focus.
  const reload = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    setStore(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const update = useCallback((fn: (prev: TrainingStore) => TrainingStore) => {
    setStore(prev => {
      const next = fn(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const saveSession = useCallback(
    (kidId: string, shots: Shot[], opts?: {
      drillId?: string; drillName?: string; target?: number;
      completed?: boolean; date?: number;
    }) => {
      const session: Session = {
        id: Date.now().toString(),
        kidId,
        date: opts?.date ?? Date.now(),
        drillId: opts?.drillId,
        drillName: opts?.drillName,
        target: opts?.target,
        shots,
        completed: opts?.completed ?? false,
      };
      update(prev => ({ ...prev, sessions: [session, ...prev.sessions] }));
      return session;
    },
    [update],
  );

  const deleteSession = useCallback((id: string) => {
    update(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.id !== id) }));
  }, [update]);

  // Importing the same drill twice replaces it rather than duplicating.
  const addDrill = useCallback((drill: Drill) => {
    update(prev => ({
      ...prev,
      drills: [drill, ...prev.drills.filter(d => d.id !== drill.id)],
    }));
  }, [update]);

  const deleteDrill = useCallback((id: string) => {
    update(prev => ({ ...prev, drills: prev.drills.filter(d => d.id !== id) }));
  }, [update]);

  /** The target this player is held to for this drill. */
  const targetFor = useCallback(
    (kidId: string, drill: Drill): number | undefined =>
      store.targets[targetKey(kidId, drill.id)] ?? drill.target,
    [store.targets],
  );

  const setTarget = useCallback((kidId: string, drillId: string, target: number | null) => {
    update(prev => {
      const next = { ...prev.targets };
      // null clears the override, falling back to the drill's own target.
      if (target == null) delete next[targetKey(kidId, drillId)];
      else next[targetKey(kidId, drillId)] = target;
      return { ...prev, targets: next };
    });
  }, [update]);

  const hasTargetOverride = useCallback(
    (kidId: string, drillId: string) => store.targets[targetKey(kidId, drillId)] != null,
    [store.targets],
  );

  const sessionsForKid = useCallback(
    (kidId: string) =>
      store.sessions.filter(s => s.kidId === kidId).sort((a, b) => a.date - b.date),
    [store.sessions],
  );

  const allDrills = useCallback(
    (): Drill[] => [...store.drills, ...BUILT_IN_DRILLS],
    [store.drills],
  );

  const findDrill = useCallback(
    (id?: string) => (id ? allDrills().find(d => d.id === id) ?? null : null),
    [allDrills],
  );

  return {
    sessions: store.sessions,
    importedDrills: store.drills,
    loading,
    saveSession,
    deleteSession,
    addDrill,
    deleteDrill,
    sessionsForKid,
    allDrills,
    findDrill,
    targetFor,
    setTarget,
    hasTargetOverride,
    reload,
  };
}
