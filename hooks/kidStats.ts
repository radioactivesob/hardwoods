// Types and stat definitions for spectator parent mode.
// Pure module — no React, no storage — so it can be unit-tested
// and shared between the tap screen, config screen, and season view.

export type StatKey =
  | 'points2'
  | 'points3'
  | 'ftMade'
  | 'rebound'
  | 'steal'
  | 'assist'
  | 'foul'
  | 'block'
  | 'turnover'
  | 'miss2'
  | 'miss3'
  | 'ftMiss';

export interface StatDef {
  key: StatKey;
  label: string;       // tap tile label
  shortLabel: string;  // box-score column header
  points: number;      // contribution to point total
  negative?: boolean;  // shown in red on the tap grid (fouls, misses, turnovers)
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  points2:  { key: 'points2',  label: 'MADE 2',   shortLabel: '2PT', points: 2 },
  points3:  { key: 'points3',  label: 'MADE 3',   shortLabel: '3PT', points: 3 },
  ftMade:   { key: 'ftMade',   label: 'FT MADE',  shortLabel: 'FT',  points: 1 },
  rebound:  { key: 'rebound',  label: 'REBOUND',  shortLabel: 'REB', points: 0 },
  steal:    { key: 'steal',    label: 'STEAL',    shortLabel: 'STL', points: 0 },
  assist:   { key: 'assist',   label: 'ASSIST',   shortLabel: 'AST', points: 0 },
  foul:     { key: 'foul',     label: 'FOUL',     shortLabel: 'PF',  points: 0, negative: true },
  block:    { key: 'block',    label: 'BLOCK',    shortLabel: 'BLK', points: 0 },
  turnover: { key: 'turnover', label: 'TURNOVER', shortLabel: 'TO',  points: 0, negative: true },
  miss2:    { key: 'miss2',    label: 'MISS 2',   shortLabel: '2M',  points: 0, negative: true },
  miss3:    { key: 'miss3',    label: 'MISS 3',   shortLabel: '3M',  points: 0, negative: true },
  ftMiss:   { key: 'ftMiss',   label: 'FT MISS',  shortLabel: 'FTM', points: 0, negative: true },
};

// Most parents never open settings — these defaults are the product.
export const DEFAULT_ENABLED_STATS: StatKey[] = [
  'points2',
  'points3',
  'ftMade',
  'rebound',
  'steal',
  'assist',
  'foul',
];

// Keep the tap grid fat-finger-proof.
export const MAX_ENABLED_STATS = 10;

// Canonical display order for the config chips and the tap grid.
// The grid is two columns, so pairs (make | miss) land on the same row.
export const STAT_ORDER: StatKey[] = [
  'points2', 'miss2',
  'points3', 'miss3',
  'ftMade', 'ftMiss',
  'rebound', 'steal',
  'assist', 'block',
  'turnover', 'foul',
];

export function sortByStatOrder(keys: StatKey[]): StatKey[] {
  return [...keys].sort((a, b) => STAT_ORDER.indexOf(a) - STAT_ORDER.indexOf(b));
}

export interface KidProfile {
  id: string;
  name: string;
  number?: string;
  teamName?: string;
  color?: string; // accent color across My Kid screens; defaults to ball orange
  enabledStats: StatKey[];
  currentSeason?: number; // absent = 1 (pre-seasons data)
  createdAt: number;
}

export function profileSeason(profile: KidProfile): number {
  return profile.currentSeason ?? 1;
}

export const DEFAULT_KID_COLOR = '#FF8A1F';

export const KID_COLORS = [
  '#FF8A1F', '#1E90FF', '#FF4500', '#32CD32',
  '#FF1493', '#FFD700', '#9400D3', '#00CED1',
];

export function kidColor(profile: KidProfile): string {
  return profile.color ?? DEFAULT_KID_COLOR;
}

// One tap during a game. The event log is the source of truth:
// it powers undo, and totals are always derived from it.
export interface StatEvent {
  key: StatKey;
  at: number; // epoch ms
}

export interface GameEntry {
  id: string;
  kidId: string;
  date: number; // epoch ms, game day
  opponent?: string;
  season?: number; // absent = 1 (games saved before seasons existed)
  teamScore?: { us: number; them: number }; // optional final team score for context
  events: StatEvent[];
  totals: Record<StatKey, number>; // derived from events at save time
}

// "W 30–28" / "L 28–35" / "T 20–20", or null when no score was entered.
export function gameResult(game: GameEntry): string | null {
  if (!game.teamScore) return null;
  const { us, them } = game.teamScore;
  const letter = us > them ? 'W' : us < them ? 'L' : 'T';
  return `${letter} ${us}–${them}`;
}

export function gameSeason(game: GameEntry): number {
  return game.season ?? 1;
}

export function emptyTotals(): Record<StatKey, number> {
  const t = {} as Record<StatKey, number>;
  (Object.keys(STAT_DEFS) as StatKey[]).forEach(k => { t[k] = 0; });
  return t;
}

export function totalsFromEvents(events: StatEvent[]): Record<StatKey, number> {
  const t = emptyTotals();
  events.forEach(e => { t[e.key] += 1; });
  return t;
}

export function pointsFromTotals(totals: Record<StatKey, number>): number {
  return (Object.keys(STAT_DEFS) as StatKey[]).reduce(
    (sum, k) => sum + STAT_DEFS[k].points * (totals[k] ?? 0),
    0,
  );
}

// Shooting percentages need makes and misses paired up.
export function shootingLine(totals: Record<StatKey, number>) {
  const fgMade = (totals.points2 ?? 0) + (totals.points3 ?? 0);
  const fgAttempted = fgMade + (totals.miss2 ?? 0) + (totals.miss3 ?? 0);
  const threeMade = totals.points3 ?? 0;
  const threeAttempted = threeMade + (totals.miss3 ?? 0);
  const ftMade = totals.ftMade ?? 0;
  const ftAttempted = ftMade + (totals.ftMiss ?? 0);
  return { fgMade, fgAttempted, threeMade, threeAttempted, ftMade, ftAttempted };
}
