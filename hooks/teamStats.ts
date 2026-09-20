// Team Stats mode: My Kid's tap-to-record grid, applied to a whole roster.
// Pure module — no React, no storage — so the event→box-score math can be
// checked in node the same way kidStats and kidTransfer are.

import type { PlayerStats } from '../context/GameContext';
import type { SavedTeam } from './useTeamLibrary';
import type { ArchivedGame, ArchivedPlayer } from './useTeamGames';
import {
  StatKey, StatEvent, emptyTotals, pointsFromTotals, shootingLine, DEFAULT_ENABLED_STATS,
} from './kidStats';

export const TEAM_STATS_IN_PROGRESS_KEY = 'hardwoods_teamstats_inprogress';

/** One tap: which player, which stat, when. */
export interface TeamStatEvent extends StatEvent {
  /** Index into the saved team's player list — stable for the life of a game. */
  player: number;
}

export interface TeamStatsInProgress {
  teamId: string;
  opponent: string;
  startedAt: number;
  events: TeamStatEvent[];
  /** Players marked out for the night (indices), so a resumed game keeps them hidden. */
  out: number[];
}

/**
 * Jersey order, the way a coach reads a roster: numeric where both sides
 * parse (#9 before #10, not after #1), anything unparseable last, and a
 * stable tie-break on the original position so equal numbers don't shuffle.
 */
export function byJersey<T extends { number?: string }>(a: T & { i: number }, b: T & { i: number }): number {
  const na = parseInt(a.number ?? '', 10);
  const nb = parseInt(b.number ?? '', 10);
  const va = Number.isNaN(na) ? Number.POSITIVE_INFINITY : na;
  const vb = Number.isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
  return va - vb || a.i - b.i;
}

/**
 * Fouls to the limit, for tinting a player's chip. Team Stats has no rules
 * screen, so this assumes the five-foul limit nearly every youth league uses.
 */
export const FOUL_LIMIT = 5;
export type FoulState = 'ok' | 'trouble' | 'danger' | 'out';
export function foulState(fouls: number): FoulState {
  if (fouls >= FOUL_LIMIT) return 'out';
  if (fouls >= FOUL_LIMIT - 1) return 'danger';
  if (fouls >= FOUL_LIMIT - 2) return 'trouble';
  return 'ok';
}

export function teamEnabledStats(team: Pick<SavedTeam, 'enabledStats'>): StatKey[] {
  return team.enabledStats && team.enabledStats.length > 0 ? team.enabledStats : DEFAULT_ENABLED_STATS;
}

/** Per-player totals keyed by player index; every rostered player gets a row. */
export function totalsByPlayer(events: TeamStatEvent[], playerCount: number): Record<StatKey, number>[] {
  const rows = Array.from({ length: playerCount }, () => emptyTotals());
  events.forEach(e => {
    if (rows[e.player]) rows[e.player][e.key] += 1;
  });
  return rows;
}

export function teamPoints(events: TeamStatEvent[], playerCount: number): number {
  return totalsByPlayer(events, playerCount).reduce((s, t) => s + pointsFromTotals(t), 0);
}

/**
 * The scorebook's narrower stat line, derived from the richer kid-stat
 * totals so a Team Stats game reads the same as a scorebook game in Team
 * Seasons.
 */
export function playerStatsFromTotals(totals: Record<StatKey, number>): PlayerStats {
  const line = shootingLine(totals);
  return {
    points: pointsFromTotals(totals),
    fgMade: line.fgMade,
    fgAttempted: line.fgAttempted,
    threeMade: line.threeMade,
    threeAttempted: line.threeAttempted,
    ftMade: line.ftMade,
    ftAttempted: line.ftAttempted,
    fouls: totals.foul ?? 0,
  };
}

/**
 * The reverse bridge: a scorebook line as a synthetic tap log, so a game
 * kept in the Full Scorebook can land in a My Kid profile shaped like every
 * other game there. Rebounds, steals and assists aren't in the book, so
 * they're honestly absent rather than zero-filled.
 */
export function eventsFromPlayerStats(stats: PlayerStats, at: number): StatEvent[] {
  const counts: [StatKey, number][] = [
    ['points3', stats.threeMade],
    ['miss3', stats.threeAttempted - stats.threeMade],
    ['points2', stats.fgMade - stats.threeMade],
    ['miss2', (stats.fgAttempted - stats.fgMade) - (stats.threeAttempted - stats.threeMade)],
    ['ftMade', stats.ftMade],
    ['ftMiss', stats.ftAttempted - stats.ftMade],
    ['foul', stats.fouls],
  ];
  const events: StatEvent[] = [];
  let t = at;
  counts.forEach(([key, n]) => {
    for (let i = 0; i < Math.max(0, n); i++) {
      t += 1000;
      events.push({ key, at: t });
    }
  });
  return events;
}

export function eventsForPlayer(events: TeamStatEvent[], player: number): StatEvent[] {
  return events.filter(e => e.player === player).map(({ key, at }) => ({ key, at }));
}

/**
 * Build the archive entry. Our side carries every rostered player who
 * dressed, with both the scorebook line and the full totals/event log; the
 * opponent is a name and a score, nothing more.
 */
export function archivedGameFromTeamStats(
  team: SavedTeam,
  opponent: string,
  score: { us: number; them: number },
  events: TeamStatEvent[],
  out: number[],
  date: number,
): ArchivedGame {
  const totals = totalsByPlayer(events, team.players.length);
  const players: ArchivedPlayer[] = team.players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => (p.name || p.number) && !out.includes(i))
    .map(({ p, i }) => ({
      name: p.name,
      number: p.number,
      stats: playerStatsFromTotals(totals[i]),
      totals: totals[i],
      events: eventsForPlayer(events, i),
    }));
  return {
    id: `ts-${date}`,
    date,
    source: 'teamstats',
    teamA: { name: team.name, color: team.color, players },
    teamB: { name: opponent.trim() || 'Opponent', color: '#666666', players: [] },
    periodScores: [{ teamA: score.us, teamB: score.them }],
    finalA: score.us,
    finalB: score.them,
  };
}
