import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface Player {
  id: string;
  name: string;
  number: string;
  isStarting: boolean;
  isActive: boolean;
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
  preset: 'preset1' | 'preset2' | 'custom';
  numPeriods: number;
  periodMinutes: number;
  timeoutsPerHalf: number;
  timeoutsPerGame: number;
  foulLimitForBonus: number;
  overtimeMinutes: number;
  personalFoulLimit: number;
  foulsResetAtHalf: boolean;
  technicalFoulShots: number;
  playerTechIsPersonalFoul: boolean;
}

export interface SavedPreset {
  name: string;
  numPeriods: number;
  periodMinutes: number;
  timeoutsPerHalf: number;
  timeoutsPerGame: number;
  foulLimitForBonus: number;
  overtimeMinutes: number;
  personalFoulLimit: number;
  foulsResetAtHalf: boolean;
  technicalFoulShots: number;
  playerTechIsPersonalFoul: boolean;
}

export interface PeriodScore {
  teamA: number;
  teamB: number;
}

export interface GameState {
  teamA: TeamConfig;
  teamB: TeamConfig;
  rules: RulesConfig;
  presets: [SavedPreset, SavedPreset];
  currentPeriod: number;
  periodScores: PeriodScore[];
  teamAFouls: number;
  teamBFouls: number;
  teamATimeoutsLeft: number;
  teamBTimeoutsLeft: number;
  gameStarted: boolean;
}

const defaultPreset1: SavedPreset = {
  name: 'STD YOUTH',
  numPeriods: 4,
  periodMinutes: 8,
  timeoutsPerHalf: 2,
  timeoutsPerGame: 5,
  foulLimitForBonus: 7,
  overtimeMinutes: 4,
  personalFoulLimit: 5,
  foulsResetAtHalf: false,
  technicalFoulShots: 2,
  playerTechIsPersonalFoul: true,
};

const defaultPreset2: SavedPreset = {
  name: 'NFHS',
  numPeriods: 4,
  periodMinutes: 8,
  timeoutsPerHalf: 3,
  timeoutsPerGame: 5,
  foulLimitForBonus: 7,
  overtimeMinutes: 4,
  personalFoulLimit: 5,
  foulsResetAtHalf: false,
  technicalFoulShots: 2,
  playerTechIsPersonalFoul: true,
};

const defaultRules: RulesConfig = {
  preset: 'preset1',
  ...defaultPreset1,
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
  presets: [defaultPreset1, defaultPreset2],
  currentPeriod: 1,
  periodScores: [{ teamA: 0, teamB: 0 }],
  teamAFouls: 0,
  teamBFouls: 0,
  teamATimeoutsLeft: defaultRules.timeoutsPerGame,
  teamBTimeoutsLeft: defaultRules.timeoutsPerGame,
  gameStarted: false,
};

type Action =
  | { type: 'ADD_POINTS'; team: 'A' | 'B'; playerId: string; points: number; isFreeThrow?: boolean; made?: boolean; missed?: boolean }
  | { type: 'ADD_FOUL'; team: 'A' | 'B'; playerId: string }
  | { type: 'ADD_TECHNICAL'; team: 'A' | 'B' }
  | { type: 'USE_TIMEOUT'; team: 'A' | 'B' }
  | { type: 'NEXT_PERIOD' }
  | { type: 'PREV_PERIOD' }
  | { type: 'SET_TEAM'; team: 'A' | 'B'; config: TeamConfig }
  | { type: 'SET_RULES'; rules: RulesConfig }
  | { type: 'SAVE_PRESET'; index: 0 | 1; preset: SavedPreset }
  | { type: 'SUBSTITUTE'; team: 'A' | 'B'; outPlayerId: string; inPlayerId: string }
  | { type: 'EDIT_PLAYER_STATS'; team: 'A' | 'B'; playerId: string; stats: PlayerStats }
  | { type: 'RESET_GAME' }
  | { type: 'START_GAME' };

const resetPlayerFouls = (team: TeamConfig): TeamConfig => ({
  ...team,
  players: team.players.map(p => ({ ...p, stats: { ...p.stats, fouls: 0 } })),
});

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ADD_POINTS': {
      const teamKey = action.team === 'A' ? 'teamA' : 'teamB';
      const periodIdx = state.currentPeriod - 1;
      const newScores = [...state.periodScores];
      const scoreKey = action.team === 'A' ? 'teamA' : 'teamB';

      if (action.points > 0 && !action.missed) {
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
        } else if (action.missed) {
          // Missed shot — only increment attempt counter
          s.fgAttempted += 1;
          if (action.points === 3) s.threeAttempted += 1;
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

    case 'ADD_TECHNICAL': {
      // Coach technical — counts as team foul, no personal foul on a player
      const teamFoulKey = action.team === 'A' ? 'teamAFouls' : 'teamBFouls';
      return { ...state, [teamFoulKey]: state[teamFoulKey] + 1 };
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
      const halfPoint = state.rules.numPeriods / 2;
      const crossingHalf = state.rules.foulsResetAtHalf && state.currentPeriod === halfPoint;

      return {
        ...state,
        currentPeriod: nextPeriod,
        periodScores: newScores,
        teamAFouls: 0,
        teamBFouls: 0,
        teamA: crossingHalf ? resetPlayerFouls(state.teamA) : state.teamA,
        teamB: crossingHalf ? resetPlayerFouls(state.teamB) : state.teamB,
      };
    }

    case 'PREV_PERIOD': {
      if (state.currentPeriod <= 1) return state;
      const prevPeriod = state.currentPeriod - 1;
      const newScores = state.periodScores.slice(0, -1);
      return {
        ...state,
        currentPeriod: prevPeriod,
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

    case 'SAVE_PRESET': {
      const newPresets: [SavedPreset, SavedPreset] = [...state.presets] as [SavedPreset, SavedPreset];
      newPresets[action.index] = action.preset;
      return { ...state, presets: newPresets };
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
        presets: state.presets, // preserve saved presets across games
        teamA: { ...initialState.teamA },
        teamB: { ...initialState.teamB },
      };
    }

    case 'EDIT_PLAYER_STATS': {
      const teamKey = action.team === 'A' ? 'teamA' : 'teamB';
      const updatedPlayers = state[teamKey].players.map(p =>
        p.id === action.playerId ? { ...p, stats: action.stats } : p
      );
      // Recalculate period scores from scratch based on all player stats
      const teamA = action.team === 'A'
        ? { ...state.teamA, players: updatedPlayers }
        : state.teamA;
      const teamB = action.team === 'B'
        ? { ...state.teamB, players: updatedPlayers }
        : state.teamB;
      const totalA = teamA.players.reduce((s, p) => s + p.stats.points, 0);
      const totalB = teamB.players.reduce((s, p) => s + p.stats.points, 0);
      // Distribute corrected total into current period, keeping other periods intact
      const otherPeriodsA = state.periodScores.slice(0, -1).reduce((s, p) => s + p.teamA, 0);
      const otherPeriodsB = state.periodScores.slice(0, -1).reduce((s, p) => s + p.teamB, 0);
      const newScores = [
        ...state.periodScores.slice(0, -1),
        { teamA: Math.max(0, totalA - otherPeriodsA), teamB: Math.max(0, totalB - otherPeriodsB) },
      ];
      return { ...state, teamA, teamB, periodScores: newScores };
    }

    case 'START_GAME': {
      return { ...state, gameStarted: true };
    }

    default:
      return state;
  }
}

const UNDO_LIMIT = 10;

// Actions that shouldn't be undoable (config changes, not game events)
const NON_UNDOABLE = new Set(['SET_TEAM', 'SET_RULES', 'SAVE_PRESET', 'START_GAME']);

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  undo: () => void;
  canUndo: boolean;
  totalScore: (team: 'A' | 'B') => number;
  activePlayers: (team: 'A' | 'B') => Player[];
  benchPlayers: (team: 'A' | 'B') => Player[];
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = React.useState<GameState>(initialState);
  const [history, setHistory] = React.useState<GameState[]>([]);

  const dispatch = React.useCallback((action: Action) => {
    setStateInternal(current => {
      const next = gameReducer(current, action);
      if (!NON_UNDOABLE.has(action.type)) {
        setHistory(h => [...h.slice(-UNDO_LIMIT + 1), current]);
      }
      return next;
    });
  }, []);

  const undo = React.useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setStateInternal(prev);
      return h.slice(0, -1);
    });
  }, []);

  const canUndo = history.length > 0;

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
    <GameContext.Provider value={{ state, dispatch, undo, canUndo, totalScore, activePlayers, benchPlayers }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
