// A whole team season, in one file.
//
// The coach's ask: stop sending screenshots of a box score, send the season
// so it can be opened, sorted and understood — "I want to see turnovers and
// know how to coach to improve." A picture can't answer a follow-up question;
// the archive can.
//
// Built on teamTransfer: same fingerprint, same per-game parser, same dedup.
// A season file is the N-game version of a team game, not a new idea.
//
// Pure module: no React, no storage, no I/O.

import type { ArchivedGame } from './useTeamGames';
import {
  fingerprintTeamGame, parseArchivedGame, importedGameId,
} from './teamTransfer';

export const TEAM_SEASON_FORMAT = 'hardwoods.teamseason.v1';

export interface TeamSeasonFile {
  format: typeof TEAM_SEASON_FORMAT;
  exportedAt: number;
  appVersion?: string;
  /** Whose season this is — the side every game is normalised to. */
  team: { name: string; color: string };
  games: ArchivedGame[];
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Games as this team sees them. The archive stores whichever side the team
 * happened to be on, so flip any game where they're teamB — the receiving
 * phone should never have to care which way round it was recorded.
 */
function asOurs(game: ArchivedGame, teamName: string): ArchivedGame {
  if (norm(game.teamA.name) === norm(teamName)) return game;
  return {
    ...game,
    teamA: game.teamB,
    teamB: game.teamA,
    finalA: game.finalB,
    finalB: game.finalA,
    periodScores: game.periodScores.map(p => ({ teamA: p.teamB, teamB: p.teamA })),
  };
}

export function buildTeamSeason(
  teamName: string,
  color: string,
  games: ArchivedGame[],
  appVersion?: string,
): TeamSeasonFile {
  return {
    format: TEAM_SEASON_FORMAT,
    exportedAt: Date.now(),
    appVersion,
    team: { name: teamName.trim(), color },
    games: games
      .map(g => asOurs(g, teamName))
      .sort((a, b) => a.date - b.date),
  };
}

export type TeamSeasonParse =
  | { ok: true; file: TeamSeasonFile }
  | { ok: false; error: string };

export function parseTeamSeason(raw: unknown): TeamSeasonParse {
  const f = raw as Partial<TeamSeasonFile>;
  if (!f || typeof f !== 'object') return { ok: false, error: 'That file is not a Hardwoods export.' };
  if (f.format !== TEAM_SEASON_FORMAT) {
    return { ok: false, error: 'Unrecognized file format — it may be from a newer version of Hardwoods.' };
  }
  if (!f.team || typeof f.team.name !== 'string' || !f.team.name.trim()) {
    return { ok: false, error: "That file doesn't say which team it's for." };
  }
  if (!Array.isArray(f.games) || f.games.length === 0) {
    return { ok: false, error: 'That file has no games in it.' };
  }

  // One malformed game shouldn't cost the coach the whole season, but a file
  // where nothing parses is a real error rather than an empty import.
  const games: ArchivedGame[] = [];
  let firstError: string | null = null;
  for (const raw of f.games) {
    const parsed = parseArchivedGame(raw);
    if (parsed.ok) games.push(parsed.game);
    else if (!firstError) firstError = parsed.error;
  }
  if (games.length === 0) {
    return { ok: false, error: firstError ?? 'None of the games in that file could be read.' };
  }

  return {
    ok: true,
    file: {
      format: TEAM_SEASON_FORMAT,
      exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : Date.now(),
      appVersion: typeof f.appVersion === 'string' ? f.appVersion : undefined,
      team: {
        name: f.team.name.trim(),
        color: typeof f.team.color === 'string' ? f.team.color : '#1E90FF',
      },
      games: games.sort((a, b) => a.date - b.date),
    },
  };
}

export interface SeasonMergePlan {
  fresh: ArchivedGame[];
  alreadyHave: number;
}

/** What a season import would actually add, by fingerprint. */
export function planSeasonMerge(
  file: TeamSeasonFile,
  archive: ArchivedGame[],
): SeasonMergePlan {
  const have = new Set(archive.map(fingerprintTeamGame));
  const haveIds = new Set(archive.map(g => g.id));
  const fresh = file.games.filter(g => {
    const fp = fingerprintTeamGame(g);
    return !have.has(fp) && !haveIds.has(importedGameId(fp));
  });
  return { fresh, alreadyHave: file.games.length - fresh.length };
}

/** Content-derived ids, so importing the same season twice is a no-op. */
export function toArchivedGames(games: ArchivedGame[]): ArchivedGame[] {
  return games.map(g => ({ ...g, id: importedGameId(fingerprintTeamGame(g)) }));
}

export function suggestSeasonFileName(teamName: string, count: number): string {
  const team = norm(teamName).replace(/[^\w-]+/g, '-') || 'team';
  const d = new Date().toISOString().slice(0, 10);
  return `${team}-season-${count}game${count === 1 ? '' : 's'}-${d}.hardwoods`;
}
