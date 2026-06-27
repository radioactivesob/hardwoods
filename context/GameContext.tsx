import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface Player {
  id: string;
  name: string;
  number: string;
  isStarting: boolean;
  isActive: boolean; // currently on court
  stats: PlayerStats;
}

export interface PlayerStats {
  points: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  fouls: number;
}

export interface TeamConfig {
  name: string;
  coachName: string;
  color: string;
  players: Player[];
}

export interface RulesConfig {
  preset: 'standard_youth' | 'nfhs' | 'custom';
  numPeriods: number;
  periodMinutes: number;
  timeoutsPerHalf: number;
  timeoutsPerGame: number;
  foulLimitForBonus: number;
  overtimeMinutes: number;
}

export interface PeriodScore {
  teamA: number;
  teamB: number;
}

export interface GameState {
  teamA: TeamConfig;
  teamB: TeamConfig;
  rules: RulesConfig;
  currentPeriod: number;
  periodScores: PeriodScore[];
  teamAFouls: number;
  teamBFouls: number;
  teamATimeoutsLeft: number;
  teamBTimeoutsLeft: number;
  gameStarted: boolean;
}

const defaultRules: RulesConfig = {
  preset: 'standard_youth',
  numPeriods: 4,
  periodMinutes: 8,
  timeoutsPerHalf: 2,
  timeoutsPerGame: 5,
  foulLimitForBonus: 7,
  overtimeMinutes: 4,
};

const defaultPlayer = (id: string): Player => ({
  id,
  name: '',
  number: '',
  isStarting: false,
  isActive: false,
  stats: {
    points: 0, fgMade: 0, fgAttempted: 0,
    threeMade: 0, threeAttempted: 0,
    ftMade: 0, ftAttempted: 0, fouls: 0,
  },
});

const defaultTeam = (name: string, color: string): TeamConfig => ({
  name,
  coachName: '',
  color,
  players: Array.from({ length: 5 }, (_, i) => ({
    ...defaultPlayer(`${name}-${i}`),
    name: `Player ${i + 1}`,
    number: `${i + 1}`,
    isStarting: true,
    isActive: true,
  })),
});

const initialState: GameState = {
  teamA: defaultTeam('Team A', '#1E90FF'),
  teamB: defaultTeam('Team B', '#FF4500'),
  rules: defaultRules,
  currentPeriod: 1,
  periodScores: [{ teamA: 0, teamB: 0 }],
  teamAFouls: 0,
  teamBFouls: 0,
  teamATimeoutsLeft: defaultRules.timeoutsPerGame,
  teamBTimeoutsLeft: defaultRules.timeoutsPerGame,
  gameStarted: false,
};

type Action =
  | { type: 'ADD_POINTS'; team: 'A' | 'B'; playerId: string; points: number; isFreeThrow?: boolean; made?: boolean }
  | { type: 'ADD_FOUL'; team: 'A' | 'B'; playerId: string }
  | { type: 'USE_TIMEOUT'; team: 'A' | 'B' }
  | { type: 'NEXT_PERIOD' }
  | { type: 'SET_TEAM'; team: 'A' | 'B'; config: TeamConfig }
  | { type: 'SET_RULES'; rules: RulesConfig }
  | { type: 'SUBSTITUTE'; team: 'A' | 'B'; outPlayerId: string; inPlayerId: string }
  | { type: 'RESET_GAME' }
  | { type: 'START_GAME' };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ADD_POINTS': {
      const teamKey = action.team === 'A' ? 'teamA' : 'teamB';
      const periodIdx = state.currentPeriod - 1;
      const newScores = [...state.periodScores];
      const scoreKey = action.team === 'A' ? 'teamA' : 'teamB';

      if (action.points > 0) {
        newScores[periodIdx] = {
          ...newScores[periodIdx],
          [scoreKey]: newScores[periodIdx][scoreKey] + action.points,
        };
      }

      const updatedPlayers = state[teamKey].players.map(p => {
        if (p.id !== action.playerId) return p;
        const s = { ...p.stats };
        if (action.isFreeThrow) {
          s.ftAttempted += 1;
          if (action.made) { s.ftMade += 1; s.points += 1; }
        } else if (action.points === 2) {
          s.fgAttempted += 1; s.fgMade += 1; s.points += 2;
        } else if (action.points === 3) {
          s.fgAttempted += 1; s.fgMade += 1;
          s.threeAttempted += 1; s.threeMade += 1; s.points += 3;
        }
        return { ...p, stats: s };
      });

      return {
        ...state,
        periodScores: newScores,
        [teamKey]: { ...state[teamKey], players: updatedPlayers },
      };
    }

    case 'ADD_FOUL': {
      const teamFoulKey = action.team === 'A' ? 'teamAFouls' : 'teamBFouls';
      const teamKey = action.team === 'A' ? 'teamA' : 'teamB';
      const updatedPlayers = state[teamKey].players.map(p =>
        p.id === action.playerId ? { ...p, stats: { ...p.stats, fouls: p.stats.fouls + 1 } } : p
      );
      return {
        ...state,
        [teamFoulKey]: state[teamFoulKey] + 1,
        [teamKey]: { ...state[teamKey], players: updatedPlayers },
      };
    }

    case 'USE_TIMEOUT': {
      const key = action.team === 'A' ? 'teamATimeoutsLeft' : 'teamBTimeoutsLeft';
      const current = state[key];
      if (current <= 0) return state;
      return { ...state, [key]: current - 1 };
    }

    case 'NEXT_PERIOD': {
      const nextPeriod = state.currentPeriod + 1;
      const newScores = [...state.periodScores, { teamA: 0, teamB: 0 }];
      return {
        ...state,
        currentPeriod: nextPeriod,
        periodScores: newScores,
        teamAFouls: 0,
        teamBFouls: 0,
      };
    }

    case 'SET_TEAM': {
      const key = action.team === 'A' ? 'teamA' : 'teamB';
      return { ...state, [key]: action.config };
    }

    case 'SET_RULES': {
      return {
        ...state,
        rules: action.rules,
        teamATimeoutsLeft: action.rules.timeoutsPerGame,
        teamBTimeoutsLeft: action.rules.timeoutsPerGame,
      };
    }

    case 'SUBSTITUTE': {
      const teamKey = action.team === 'A' ? 'teamA' : 'teamB';
      const updatedPlayers = state[teamKey].players.map(p => {
        if (p.id === action.outPlayerId) return { ...p, isActive: false };
        if (p.id === action.inPlayerId) return { ...p, isActive: true };
        return p;
      });
      return { ...state, [teamKey]: { ...state[teamKey], players: updatedPlayers } };
    }

    case 'RESET_GAME': {
      return {
        ...initialState,
        teamA: { ...initialState.teamA },
        teamB: { ...initialState.teamB },
      };
    }

    case 'START_GAME': {
      return { ...state, gameStarted: true };
    }

    default:
      return state;
  }
}

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  totalScore: (team: 'A' | 'B') => number;
  activePlayers: (team: 'A' | 'B') => Player[];
  benchPlayers: (team: 'A' | 'B') => Player[];
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const totalScore = (team: 'A' | 'B') => {
    const key = team === 'A' ? 'teamA' : 'teamB';
    return state.periodScores.reduce((sum, p) => sum + p[key], 0);
  };

  const activePlayers = (team: 'A' | 'B') => {
    const key = team === 'A' ? 'teamA' : 'teamB';
    return state[key].players.filter(p => p.isActive);
  };

  const benchPlayers = (team: 'A' | 'B') => {
    const key = team === 'A' ? 'teamA' : 'teamB';
    return state[key].players.filter(p => !p.isActive);
  };

  return (
    <GameContext.Provider value={{ state, dispatch, totalScore, activePlayers, benchPlayers }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
