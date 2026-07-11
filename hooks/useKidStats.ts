import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KidProfile,
  GameEntry,
  StatEvent,
  StatKey,
  DEFAULT_ENABLED_STATS,
  totalsFromEvents,
  profileSeason,
} from './kidStats';

const STORAGE_KEY = 'hardwoods_kids_v1';

interface KidStore {
  profiles: KidProfile[];
  games: GameEntry[];
}

const EMPTY_STORE: KidStore = { profiles: [], games: [] };

export function useKidStats() {
  const [store, setStore] = useState<KidStore>(EMPTY_STORE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setStore(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const update = useCallback((fn: (prev: KidStore) => KidStore) => {
    setStore(prev => {
      const next = fn(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addProfile = useCallback((name: string, number?: string, teamName?: string, color?: string) => {
    const profile: KidProfile = {
      id: Date.now().toString(),
      name,
      number,
      teamName,
      color,
      enabledStats: [...DEFAULT_ENABLED_STATS],
      createdAt: Date.now(),
    };
    update(prev => ({ ...prev, profiles: [profile, ...prev.profiles] }));
    return profile;
  }, [update]);

  const updateProfile = useCallback((id: string, changes: Partial<Omit<KidProfile, 'id' | 'createdAt'>>) => {
    update(prev => ({
      ...prev,
      profiles: prev.profiles.map(p => (p.id === id ? { ...p, ...changes } : p)),
    }));
  }, [update]);

  // Deleting a kid deletes their games too — no orphaned data.
  const deleteProfile = useCallback((id: string) => {
    update(prev => ({
      profiles: prev.profiles.filter(p => p.id !== id),
      games: prev.games.filter(g => g.kidId !== id),
    }));
  }, [update]);

  const saveGame = useCallback((kidId: string, events: StatEvent[], opts?: { opponent?: string; date?: number }) => {
    const profile = store.profiles.find(p => p.id === kidId);
    const game: GameEntry = {
      id: Date.now().toString(),
      kidId,
      date: opts?.date ?? Date.now(),
      opponent: opts?.opponent?.trim() || undefined,
      season: profile ? profileSeason(profile) : 1,
      events,
      totals: totalsFromEvents(events),
    };
    update(prev => ({ ...prev, games: [game, ...prev.games] }));
    return game;
  }, [update, store.profiles]);

  const startNewSeason = useCallback((kidId: string) => {
    update(prev => ({
      ...prev,
      profiles: prev.profiles.map(p =>
        p.id === kidId ? { ...p, currentSeason: profileSeason(p) + 1 } : p,
      ),
    }));
  }, [update]);

  const deleteGame = useCallback((id: string) => {
    update(prev => ({ ...prev, games: prev.games.filter(g => g.id !== id) }));
  }, [update]);

  const gamesForKid = useCallback(
    (kidId: string) => store.games.filter(g => g.kidId === kidId).sort((a, b) => a.date - b.date),
    [store.games],
  );

  return {
    profiles: store.profiles,
    games: store.games,
    loading,
    addProfile,
    updateProfile,
    deleteProfile,
    saveGame,
    deleteGame,
    gamesForKid,
    startNewSeason,
  };
}
