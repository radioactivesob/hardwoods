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

export interface KidProfile {
  id: string;
  name: string;
  number?: string;
  teamName?: string;
  enabledStats: StatKey[];
  createdAt: number;
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
  events: StatEvent[];
  totals: Record<StatKey, number>; // derived from events at save time
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
