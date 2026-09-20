import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TeamConfig, Player } from '../context/GameContext';
import type { StatKey } from './kidStats';

const STORAGE_KEY = 'hardwoods_team_library';

export interface SavedTeam {
  id: string;
  savedAt: number;
  name: string;
  color: string;
  coachName: string;
  players: Pick<Player, 'name' | 'number' | 'isStarting'>[];
  /** Team Stats tap grid. Absent = My Kid defaults. Keep it stable across a season. */
  enabledStats?: StatKey[];
}

function teamToSaved(team: TeamConfig): Omit<SavedTeam, 'id' | 'savedAt'> {
  return {
    name: team.name,
    color: team.color,
    coachName: team.coachName,
    players: team.players.map(p => ({ name: p.name, number: p.number, isStarting: p.isStarting })),
  };
}

export function savedToTeamConfig(saved: SavedTeam, teamPrefix: string): TeamConfig {
  return {
    name: saved.name,
    color: saved.color,
    coachName: saved.coachName,
    players: saved.players.map((p, i) => ({
      id: `${teamPrefix}-saved-${saved.id}-${i}`,
      name: p.name,
      number: p.number,
      isStarting: p.isStarting,
      isActive: p.isStarting,
      stats: { points: 0, fgMade: 0, fgAttempted: 0, threeMade: 0, threeAttempted: 0, ftMade: 0, ftAttempted: 0, fouls: 0 },
    })),
  };
}

export function useTeamLibrary() {
  const [library, setLibrary] = useState<SavedTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setLibrary(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (teams: SavedTeam[]) => {
    setLibrary(teams);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  }, []);

  const saveTeam = useCallback(async (team: TeamConfig) => {
    const entry: SavedTeam = {
      id: Date.now().toString(),
      savedAt: Date.now(),
      ...teamToSaved(team),
    };
    // Replace existing entry with same name, otherwise prepend
    setLibrary(prev => {
      const existing = prev.find(t => t.name.toLowerCase() === team.name.toLowerCase());
      // Re-saving a roster from the scorebook must not wipe the Team Stats config.
      if (existing?.enabledStats) entry.enabledStats = existing.enabledStats;
      const filtered = prev.filter(t => t.name.toLowerCase() !== team.name.toLowerCase());
      const next = [entry, ...filtered];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    setLibrary(prev => {
      const next = prev.filter(t => t.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setTeamStats = useCallback((id: string, enabledStats: StatKey[]) => {
    setLibrary(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, enabledStats } : t));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /**
   * Edit a saved team in place. Team Stats treats the library as *the*
   * roster, so there's no separate working copy and no save step to forget.
   */
  const updateTeam = useCallback((id: string, fn: (t: SavedTeam) => SavedTeam) => {
    setLibrary(prev => {
      const next = prev.map(t => (t.id === id ? fn(t) : t));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** A new, empty team straight into the library — no scorebook slot needed. */
  const createTeam = useCallback((name: string, color: string): SavedTeam => {
    const entry: SavedTeam = {
      id: Date.now().toString(), savedAt: Date.now(),
      name: name.trim(), color, coachName: '', players: [],
    };
    setLibrary(prev => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return entry;
  }, []);

  /**
   * Append a player; returns her index so a live game can select her at
   * once. The index comes from current state, not from inside the updater —
   * React runs updaters later, so anything assigned there isn't visible here.
   */
  const addPlayer = useCallback((id: string, name: string, number: string): number => {
    const index = library.find(t => t.id === id)?.players.length ?? 0;
    updateTeam(id, t => ({
      ...t,
      players: [...t.players, { name: name.trim(), number: number.trim(), isStarting: false }],
    }));
    return index;
  }, [library, updateTeam]);

  const reload = useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setLibrary(JSON.parse(raw));
    });
  }, []);

  return {
    library, loading, saveTeam, deleteTeam, setTeamStats, updateTeam, createTeam, addPlayer, reload,
  };
}
