import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TeamConfig, Player } from '../context/GameContext';

const STORAGE_KEY = 'hardwoods_team_library';

export interface SavedTeam {
  id: string;
  savedAt: number;
  name: string;
  color: string;
  coachName: string;
  players: Pick<Player, 'name' | 'number' | 'isStarting'>[];
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

  return { library, loading, saveTeam, deleteTeam };
}
