// Sharing My Kid games between phones.
//
// The problem this solves: whoever owns the phone is also the person most
// likely to get drafted to run the scoreboard. Another parent can track the
// game on their phone and send a file; this module defines that file, and
// works out what to merge when it arrives.
//
// Deliberately a file, not sync — nothing leaves a device unless a person
// sends it. Pure module: no React, no storage, no I/O.

import {
  KidProfile, GameEntry, StatEvent, StatKey, emptyTotals, totalsFromEvents,
} from './kidStats';

export const TRANSFER_FORMAT = 'hardwoods.kidgames.v1';

/** A game as it travels — no kidId, since ids are meaningless across devices. */
export interface TransferGame {
  fingerprint: string;
  date: number;
  opponent?: string;
  teamScore?: { us: number; them: number };
  events: StatEvent[];
  totals: Record<StatKey, number>;
}

/** The player block travels so both phones can track the same stat set. */
export interface TransferPlayer {
  name: string;
  number?: string;
  teamName?: string;
  color?: string;
  enabledStats: StatKey[];
}

export interface TransferFile {
  format: typeof TRANSFER_FORMAT;
  exportedAt: number;
  appVersion?: string;
  player: TransferPlayer;
  games: TransferGame[];
}

// FNV-1a. Not cryptographic — this only needs to be stable and collision-
// resistant enough that re-importing the same file is recognised as such.
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Content-derived id. Two phones generate different local ids for their own
 * games, so dedup can't use those — but the same file imported twice must be
 * recognised. The event log is what makes a game unique.
 */
export function fingerprintGame(
  playerName: string,
  g: { date: number; opponent?: string; events: StatEvent[] },
): string {
  const canonical = [
    playerName.trim().toLowerCase(),
    g.date,
    (g.opponent ?? '').trim().toLowerCase(),
    g.events.map(e => `${e.key}@${e.at}`).join(','),
  ].join('|');
  return hash(canonical);
}

export function buildTransfer(
  profile: KidProfile,
  games: GameEntry[],
  appVersion?: string,
): TransferFile {
  return {
    format: TRANSFER_FORMAT,
    exportedAt: Date.now(),
    appVersion,
    player: {
      name: profile.name,
      number: profile.number,
      teamName: profile.teamName,
      color: profile.color,
      enabledStats: [...profile.enabledStats],
    },
    games: games.map(g => ({
      fingerprint: fingerprintGame(profile.name, g),
      date: g.date,
      opponent: g.opponent,
      teamScore: g.teamScore,
      events: g.events.map(e => ({ ...e })),
      totals: { ...g.totals },
    })),
  };
}

export type TransferParse =
  | { ok: true; file: TransferFile }
  | { ok: false; error: string };

/**
 * Strict on purpose: a malformed file should produce a readable message, not
 * a half-merged season.
 */
export function parseTransfer(raw: unknown): TransferParse {
  const f = raw as Partial<TransferFile>;
  if (!f || typeof f !== 'object') return { ok: false, error: 'That file is not a Hardwoods export.' };
  if (f.format !== TRANSFER_FORMAT) {
    return { ok: false, error: 'Unrecognised file format — it may be from a newer version of Hardwoods.' };
  }
  const p = f.player as Partial<TransferPlayer> | undefined;
  if (!p || typeof p.name !== 'string' || !p.name.trim()) {
    return { ok: false, error: "That file doesn't say which player it's for." };
  }
  if (!Array.isArray(f.games) || f.games.length === 0) {
    return { ok: false, error: 'That file has no games in it.' };
  }
  for (const g of f.games) {
    if (!g || typeof g.date !== 'number' || !Number.isFinite(g.date)) {
      return { ok: false, error: 'A game in that file has no date.' };
    }
    if (!Array.isArray(g.events)) {
      return { ok: false, error: 'A game in that file has no stats recorded.' };
    }
  }
  return {
    ok: true,
    file: {
      format: TRANSFER_FORMAT,
      exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : Date.now(),
      appVersion: typeof f.appVersion === 'string' ? f.appVersion : undefined,
      player: {
        name: p.name.trim(),
        number: typeof p.number === 'string' ? p.number : undefined,
        teamName: typeof p.teamName === 'string' ? p.teamName : undefined,
        color: typeof p.color === 'string' ? p.color : undefined,
        enabledStats: Array.isArray(p.enabledStats) ? p.enabledStats : [],
      },
      games: f.games.map(g => ({
        // Recompute rather than trusting the file, so a hand-edited or
        // older export still dedups correctly.
        fingerprint: fingerprintGame(p.name!, g),
        date: g.date,
        opponent: typeof g.opponent === 'string' ? g.opponent : undefined,
        teamScore: g.teamScore,
        events: g.events,
        totals: g.totals ?? totalsFromEvents(g.events),
      })),
    },
  };
}

export interface MergePlan {
  /** Games to add. */
  fresh: TransferGame[];
  /** Already imported — same fingerprint. Silently skipped. */
  alreadyHave: TransferGame[];
  /**
   * Same day and opponent but different stats — most likely both parents
   * tracked the same game. Worth asking about rather than deciding.
   */
  possibleOverlap: { incoming: TransferGame; existing: GameEntry }[];
}

const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

export function planMerge(
  file: TransferFile,
  existingGames: GameEntry[],
  targetKidId: string | null,
): MergePlan {
  const mine = targetKidId ? existingGames.filter(g => g.kidId === targetKidId) : [];
  const seen = new Set(
    mine.map(g => fingerprintGame(file.player.name, g)),
  );

  const plan: MergePlan = { fresh: [], alreadyHave: [], possibleOverlap: [] };
  for (const g of file.games) {
    if (seen.has(g.fingerprint)) {
      plan.alreadyHave.push(g);
      continue;
    }
    const clash = mine.find(
      e => sameDay(e.date, g.date) &&
        (e.opponent ?? '').trim().toLowerCase() === (g.opponent ?? '').trim().toLowerCase(),
    );
    if (clash) plan.possibleOverlap.push({ incoming: g, existing: clash });
    else plan.fresh.push(g);
  }
  return plan;
}

/**
 * Imported games join the season the recipient is currently in — that's the
 * normal case (a file arrives right after the game) and it's predictable.
 */
export function toGameEntry(
  g: TransferGame,
  kidId: string,
  season: number,
): GameEntry {
  return {
    id: `imp-${g.fingerprint}`,
    kidId,
    date: g.date,
    opponent: g.opponent,
    season,
    teamScore: g.teamScore,
    events: g.events,
    totals: g.totals ?? emptyTotals(),
  };
}

/** Case-insensitive match on name, preferring one whose number also matches. */
export function matchProfile(
  player: TransferPlayer,
  profiles: KidProfile[],
): KidProfile | null {
  const byName = profiles.filter(
    p => p.name.trim().toLowerCase() === player.name.trim().toLowerCase(),
  );
  if (byName.length === 0) return null;
  if (byName.length === 1) return byName[0];
  return byName.find(p => (p.number ?? '') === (player.number ?? '')) ?? byName[0];
}

export function suggestFileName(player: TransferPlayer, count: number): string {
  const safe = player.name.trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'player';
  const d = new Date().toISOString().slice(0, 10);
  // Our own extension, not .json — iOS then hands the file to Hardwoods
  // instead of previewing it as text.
  return `${safe}-${count}game${count === 1 ? '' : 's'}-${d}.hardwoods`;
}
