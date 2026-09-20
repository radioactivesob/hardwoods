// Sharing Team Stats games between phones.
//
// Whoever tracked the team isn't always the phone that keeps the season —
// and the coach may want the numbers too. This defines the file a team game
// travels in and works out what to merge when it arrives. Same principles
// as kidTransfer: a file, not sync; strict parse; content-derived ids so the
// same game imported twice is a no-op. Pure module: no React, no storage.

import type { ArchivedGame, ArchivedPlayer } from './useTeamGames';
import { StatEvent, totalsFromEvents } from './kidStats';
import { playerStatsFromTotals } from './teamStats';

export const TEAM_TRANSFER_FORMAT = 'hardwoods.teamgame.v1';

export interface TeamTransferFile {
  format: typeof TEAM_TRANSFER_FORMAT;
  exportedAt: number;
  appVersion?: string;
  fingerprint: string;
  game: ArchivedGame;
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * What makes a team game unique: our team, when, and every tap on our side.
 * The opponent's name and the final score are deliberately left out — both
 * get corrected after the fact, and a fixed-up game re-sent should still be
 * recognised as the one already here. The timestamped tap log is enough.
 */
export function fingerprintTeamGame(g: ArchivedGame): string {
  const lines = g.teamA.players
    .map(p => `${norm(p.number)}#${norm(p.name)}:${(p.events ?? []).map(e => `${e.key}@${e.at}`).join(',')}`)
    .sort()
    .join(';');
  return hash([norm(g.teamA.name), g.date, lines].join('|'));
}

export function buildTeamTransfer(game: ArchivedGame, appVersion?: string): TeamTransferFile {
  return {
    format: TEAM_TRANSFER_FORMAT,
    exportedAt: Date.now(),
    appVersion,
    fingerprint: fingerprintTeamGame(game),
    game,
  };
}

export type TeamTransferParse =
  | { ok: true; file: TeamTransferFile }
  | { ok: false; error: string };

function isEvent(e: unknown): e is StatEvent {
  const x = e as Partial<StatEvent>;
  return !!x && typeof x.key === 'string' && typeof x.at === 'number';
}

export function parseTeamTransfer(raw: unknown): TeamTransferParse {
  const f = raw as Partial<TeamTransferFile>;
  if (!f || typeof f !== 'object') return { ok: false, error: 'That file is not a Hardwoods export.' };
  if (f.format !== TEAM_TRANSFER_FORMAT) {
    return { ok: false, error: 'Unrecognized file format — it may be from a newer version of Hardwoods.' };
  }
  const g = f.game as Partial<ArchivedGame> | undefined;
  if (!g || typeof g !== 'object') return { ok: false, error: 'That file has no game in it.' };
  if (typeof g.date !== 'number' || !Number.isFinite(g.date)) return { ok: false, error: 'That game has no date.' };
  if (!g.teamA || typeof g.teamA.name !== 'string' || !g.teamA.name.trim()) {
    return { ok: false, error: "That file doesn't say which team it's for." };
  }
  if (!Array.isArray(g.teamA.players)) return { ok: false, error: 'That game has no roster.' };
  if (typeof g.finalA !== 'number' || typeof g.finalB !== 'number') {
    return { ok: false, error: 'That game has no final score.' };
  }

  // Rebuild every line from its events where we have them, so a hand-edited
  // or older file can't carry a box score that disagrees with its tap log.
  const players: ArchivedPlayer[] = g.teamA.players.map(p => {
    const events = Array.isArray(p.events) ? p.events.filter(isEvent) : undefined;
    const totals = events ? totalsFromEvents(events) : p.totals;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      number: typeof p.number === 'string' ? p.number : '',
      stats: totals ? playerStatsFromTotals(totals) : p.stats,
      totals,
      events,
    };
  });

  const game: ArchivedGame = {
    id: '',                      // assigned on import; see toArchivedGame
    date: g.date,
    source: g.source === 'scorebook' ? 'scorebook' : 'teamstats',
    teamA: { name: g.teamA.name.trim(), color: typeof g.teamA.color === 'string' ? g.teamA.color : '#1E90FF', players },
    teamB: {
      name: typeof g.teamB?.name === 'string' && g.teamB.name.trim() ? g.teamB.name.trim() : 'Opponent',
      color: typeof g.teamB?.color === 'string' ? g.teamB.color : '#666666',
      players: Array.isArray(g.teamB?.players) ? g.teamB!.players : [],
    },
    periodScores: Array.isArray(g.periodScores) && g.periodScores.length > 0
      ? g.periodScores
      : [{ teamA: g.finalA, teamB: g.finalB }],
    finalA: g.finalA,
    finalB: g.finalB,
  };

  return {
    ok: true,
    file: {
      format: TEAM_TRANSFER_FORMAT,
      exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : Date.now(),
      appVersion: typeof f.appVersion === 'string' ? f.appVersion : undefined,
      fingerprint: fingerprintTeamGame(game),
      game,
    },
  };
}

/** The id an imported game gets — stable across phones, so re-imports collide. */
export function importedGameId(fingerprint: string): string {
  return `tg-${fingerprint}`;
}

export function toArchivedGame(file: TeamTransferFile): ArchivedGame {
  return { ...file.game, id: importedGameId(file.fingerprint) };
}

/**
 * Is this game already here? By id for anything imported before, and by
 * fingerprint for a game this phone tracked itself and someone sent back.
 */
export function alreadyArchived(file: TeamTransferFile, archive: ArchivedGame[]): boolean {
  const id = importedGameId(file.fingerprint);
  return archive.some(g => g.id === id || fingerprintTeamGame(g) === file.fingerprint);
}

export function suggestTeamFileName(game: ArchivedGame): string {
  const team = norm(game.teamA.name).replace(/[^\w-]+/g, '-') || 'team';
  const opp = norm(game.teamB.name).replace(/[^\w-]+/g, '-') || 'game';
  const d = new Date(game.date).toISOString().slice(0, 10);
  return `${team}-vs-${opp}-${d}.hardwoods`;
}
