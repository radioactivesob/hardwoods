import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, PlayerStats, PeriodScore } from '../context/GameContext';

const STORAGE_KEY = 'hardwoods_team_games_v1';

// A finished game, archived from the full scorebook. Both teams'
// box scores are kept, so any team's season can be assembled by
// grouping archived games by team name.
export interface ArchivedPlayer {
  name: string;
  number: string;
  stats: PlayerStats;
}

export interface ArchivedTeam {
  name: string;
  color: string;
  players: ArchivedPlayer[];
}

export interface ArchivedGame {
  id: string;
  date: number;
  teamA: ArchivedTeam;
  teamB: ArchivedTeam;
  periodScores: PeriodScore[];
  finalA: number;
  finalB: number;
}

function archiveTeam(team: GameState['teamA']): ArchivedTeam {
  return {
    name: team.name,
    color: team.color,
    players: team.players
      .filter(p => p.name || p.number)
      .map(p => ({ name: p.name, number: p.number, stats: { ...p.stats } })),
  };
}

export function archivedGameFromState(state: GameState): ArchivedGame {
  const finalA = state.periodScores.reduce((s, p) => s + p.teamA, 0);
  const finalB = state.periodScores.reduce((s, p) => s + p.teamB, 0);
  return {
    id: Date.now().toString(),
    date: Date.now(),
    teamA: archiveTeam(state.teamA),
    teamB: archiveTeam(state.teamB),
    periodScores: state.periodScores.map(p => ({ ...p })),
    finalA,
    finalB,
  };
}

export function useTeamGames() {
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setGames(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const archiveGame = useCallback((game: ArchivedGame) => {
    setGames(prev => {
      const next = [game, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteGame = useCallback((id: string) => {
    setGames(prev => {
      const next = prev.filter(g => g.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Every team name seen in the archive, with its W-L record.
  const teams = useCallback(() => {
    const map = new Map<string, { name: string; color: string; wins: number; losses: number; ties: number; games: number }>();
    games.forEach(g => {
      [
        { t: g.teamA, mine: g.finalA, theirs: g.finalB },
        { t: g.teamB, mine: g.finalB, theirs: g.finalA },
      ].forEach(({ t, mine, theirs }) => {
        if (!t.name.trim()) return;
        const key = t.name.trim().toLowerCase();
        const entry = map.get(key) ?? { name: t.name.trim(), color: t.color, wins: 0, losses: 0, ties: 0, games: 0 };
        entry.games += 1;
        if (mine > theirs) entry.wins += 1;
        else if (mine < theirs) entry.losses += 1;
        else entry.ties += 1;
        entry.color = t.color;
        map.set(key, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.games - a.games);
  }, [games]);

  // A team's games, oldest first, normalized to us-vs-them.
  const gamesForTeam = useCallback((teamName: string) => {
    const key = teamName.trim().toLowerCase();
    return games
      .filter(g => g.teamA.name.trim().toLowerCase() === key || g.teamB.name.trim().toLowerCase() === key)
      .map(g => {
        const isA = g.teamA.name.trim().toLowerCase() === key;
        return {
          game: g,
          us: isA ? g.teamA : g.teamB,
          them: isA ? g.teamB : g.teamA,
          usScore: isA ? g.finalA : g.finalB,
          themScore: isA ? g.finalB : g.finalA,
        };
      })
      .sort((a, b) => a.game.date - b.game.date);
  }, [games]);

  return { games, loading, archiveGame, deleteGame, teams, gamesForTeam };
}
