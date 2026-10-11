// Everything about one kid, in one file.
//
// Two problems this solves. The app is on-device by design, so deleting it
// deletes a season — that actually happened, and training was the part with
// no way back. And the Growth view can only be calibrated against a real
// season, which has to be able to leave the phone to be worked on.
//
// Deliberately one format rather than separate game/training exports: a
// backup needs all of it, and two overlapping formats would drift. Games
// travel in exactly the shape kidTransfer already defines, so the sharing
// path and the backup path can't disagree about what a game is.
//
// Pure module: no React, no storage, no I/O.

import {
  KidProfile, GameEntry, StatKey,
} from './kidStats';
import {
  TransferGame, TransferPlayer, buildTransfer, parseTransfer, TRANSFER_FORMAT,
  fingerprintGame, toGameEntry,
} from './kidTransfer';
import type { Session, Shot, Drill } from './trainingStats';

export const PROFILE_FORMAT = 'hardwoods.profile.v1';

/** A training session as it travels — no kidId, which is device-local. */
export interface TransferSession {
  fingerprint: string;
  date: number;
  drillId?: string;
  drillName?: string;
  target?: number;
  completed: boolean;
  shots: Shot[];
}

export interface ProfileBackup {
  format: typeof PROFILE_FORMAT;
  exportedAt: number;
  appVersion?: string;
  player: TransferPlayer;
  games: TransferGame[];
  sessions: TransferSession[];
  /** Her per-drill target overrides, keyed by drill id (kid ids don't travel). */
  targets: Record<string, number>;
  /** Coach-provided drills her sessions or targets refer to. Built-ins live
   *  in code on both ends, so only custom ones need carrying. */
  drills: Drill[];
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * What makes a session unique: whose it is, when, and every shot. Two
 * sessions of the same drill on the same evening differ by their shot
 * timestamps, which is enough.
 */
export function fingerprintSession(
  playerName: string,
  s: { date: number; drillId?: string; shots: Shot[] },
): string {
  return hash([
    playerName.trim().toLowerCase(),
    s.date,
    s.drillId ?? 'free',
    s.shots.map(sh => `${sh.made ? 1 : 0}@${sh.at}`).join(','),
  ].join('|'));
}

export function buildProfileBackup(
  profile: KidProfile,
  games: GameEntry[],
  sessions: Session[],
  targets: Record<string, number>,
  customDrills: Drill[],
  appVersion?: string,
): ProfileBackup {
  // Reuse the sharing format's game mapping rather than restating it.
  const gameFile = buildTransfer(profile, games, appVersion);

  // Only the drills this kid's data actually refers to.
  const wanted = new Set<string>();
  sessions.forEach(s => { if (s.drillId) wanted.add(s.drillId); });
  Object.keys(targets).forEach(id => wanted.add(id));

  return {
    format: PROFILE_FORMAT,
    exportedAt: Date.now(),
    appVersion,
    player: gameFile.player,
    games: gameFile.games,
    sessions: sessions.map(s => ({
      fingerprint: fingerprintSession(profile.name, s),
      date: s.date,
      drillId: s.drillId,
      drillName: s.drillName,
      target: s.target,
      completed: s.completed,
      shots: s.shots.map(sh => ({ ...sh })),
    })),
    targets: { ...targets },
    drills: customDrills.filter(d => wanted.has(d.id)),
  };
}

export type ProfileParse =
  | { ok: true; file: ProfileBackup }
  | { ok: false; error: string };

function isShot(s: unknown): s is Shot {
  const x = s as Partial<Shot>;
  return !!x && typeof x.made === 'boolean' && typeof x.at === 'number'
    && typeof x.x === 'number' && typeof x.y === 'number' && typeof x.zoneId === 'string';
}

export function parseProfileBackup(raw: unknown): ProfileParse {
  const f = raw as Partial<ProfileBackup>;
  if (!f || typeof f !== 'object') return { ok: false, error: 'That file is not a Hardwoods export.' };
  if (f.format !== PROFILE_FORMAT) {
    return { ok: false, error: 'Unrecognized file format — it may be from a newer version of Hardwoods.' };
  }
  const p = f.player as Partial<TransferPlayer> | undefined;
  if (!p || typeof p.name !== 'string' || !p.name.trim()) {
    return { ok: false, error: "That file doesn't say which player it's for." };
  }

  // Games ride through the sharing format's own parser, so there's exactly
  // one place that decides whether a game is well-formed. An empty game list
  // is fine here — a kid may have only practised.
  let games: TransferGame[] = [];
  if (Array.isArray(f.games) && f.games.length > 0) {
    const asTransfer = parseTransfer({
      format: TRANSFER_FORMAT,
      exportedAt: f.exportedAt,
      appVersion: f.appVersion,
      player: f.player,
      games: f.games,
    });
    if (!asTransfer.ok) return { ok: false, error: asTransfer.error };
    games = asTransfer.file.games;
  }

  const name = p.name.trim();
  const sessions: TransferSession[] = Array.isArray(f.sessions)
    ? f.sessions
        .filter(s => s && typeof s.date === 'number' && Number.isFinite(s.date) && Array.isArray(s.shots))
        .map(s => {
          const shots = s.shots.filter(isShot);
          return {
            // Recomputed rather than trusted, so a hand-edited or older
            // export still dedups correctly.
            fingerprint: fingerprintSession(name, { date: s.date, drillId: s.drillId, shots }),
            date: s.date,
            drillId: typeof s.drillId === 'string' ? s.drillId : undefined,
            drillName: typeof s.drillName === 'string' ? s.drillName : undefined,
            target: typeof s.target === 'number' ? s.target : undefined,
            completed: s.completed === true,
            shots,
          };
        })
    : [];

  if (games.length === 0 && sessions.length === 0) {
    return { ok: false, error: 'That file has no games or training sessions in it.' };
  }

  const targets: Record<string, number> = {};
  if (f.targets && typeof f.targets === 'object') {
    Object.entries(f.targets).forEach(([k, v]) => {
      if (typeof v === 'number' && v > 0 && v <= 1) targets[k] = v;
    });
  }

  return {
    ok: true,
    file: {
      format: PROFILE_FORMAT,
      exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : Date.now(),
      appVersion: typeof f.appVersion === 'string' ? f.appVersion : undefined,
      player: {
        name,
        number: typeof p.number === 'string' ? p.number : undefined,
        teamName: typeof p.teamName === 'string' ? p.teamName : undefined,
        color: typeof p.color === 'string' ? p.color : undefined,
        enabledStats: Array.isArray(p.enabledStats) ? (p.enabledStats as StatKey[]) : [],
      },
      games,
      sessions,
      targets,
      drills: Array.isArray(f.drills) ? f.drills.filter(d => d && typeof d.id === 'string') : [],
    },
  };
}

/** Content-derived id, so restoring the same backup twice is a no-op. */
export function importedSessionId(fingerprint: string): string {
  return `imp-${fingerprint}`;
}

export function toSession(s: TransferSession, kidId: string): Session {
  return {
    id: importedSessionId(s.fingerprint),
    kidId,
    date: s.date,
    drillId: s.drillId,
    drillName: s.drillName,
    target: s.target,
    shots: s.shots,
    completed: s.completed,
  };
}

export interface RestorePlan {
  freshGames: TransferGame[];
  freshSessions: TransferSession[];
  haveGames: number;
  haveSessions: number;
}

/**
 * What a restore would actually add. Everything already present is skipped
 * silently — restoring onto a phone that has most of it is the normal case
 * when someone backs up, keeps playing, then restores an old file.
 */
export function planRestore(
  file: ProfileBackup,
  existingGames: GameEntry[],
  existingSessions: Session[],
): RestorePlan {
  const gameFps = new Set(existingGames.map(g => fingerprintGame(file.player.name, g)));
  const sessionFps = new Set(
    existingSessions.map(s => fingerprintSession(file.player.name, s)),
  );
  const freshGames = file.games.filter(g => !gameFps.has(g.fingerprint));
  const freshSessions = file.sessions.filter(s => !sessionFps.has(s.fingerprint));
  return {
    freshGames,
    freshSessions,
    haveGames: file.games.length - freshGames.length,
    haveSessions: file.sessions.length - freshSessions.length,
  };
}

export function suggestBackupFileName(player: TransferPlayer): string {
  const safe = player.name.trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'player';
  const d = new Date().toISOString().slice(0, 10);
  return `${safe}-backup-${d}.hardwoods`;
}

export { toGameEntry };
