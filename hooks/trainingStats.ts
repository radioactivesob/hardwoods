// Types, court geometry, and stat math for training mode.
// Pure module — no React, no storage — so it can be unit-tested and
// shared between the drill runner, the shot chart, and the history view.
//
// Court coordinates are normalised: x 0 = left sideline, 1 = right
// sideline; y 0 = baseline, 1 = half-court line. Screens scale these to
// whatever size they draw the court at, so the data outlives the layout.

export const COURT_WIDTH_FT = 50;
export const COURT_DEPTH_FT = 47;
export const HOOP_X = 0.5;
export const HOOP_Y = 5.25 / COURT_DEPTH_FT;   // hoop centre sits 5'3" off the baseline
export const LANE_HALF_FT = 6;                 // 12 ft lane (high school / youth)
export const FT_LINE_FT = 19;                  // free-throw line, from the baseline
export const THREE_PT_FT = 19.75;              // high-school arc

// ---------------------------------------------------------------- zones

export type ZoneKind =
  | 'paint' | 'freeThrow' | 'elbow' | 'baseline' | 'wing'
  | 'corner3' | 'wing3' | 'top3';

export type Side = 'left' | 'center' | 'right';

export type ZoneId =
  | 'paint' | 'freeThrow'
  | 'leftElbow' | 'rightElbow'
  | 'leftBaseline' | 'rightBaseline'
  | 'leftWing' | 'rightWing'
  | 'leftCorner3' | 'rightCorner3'
  | 'leftWing3' | 'rightWing3'
  | 'top3';

export interface Zone {
  id: ZoneId;
  kind: ZoneKind;   // stats can roll up by kind, combining left and right
  side: Side;
  label: string;
  isThree: boolean;
}

export const ZONES: Record<ZoneId, Zone> = {
  paint:         { id: 'paint',         kind: 'paint',     side: 'center', label: 'Paint',            isThree: false },
  freeThrow:     { id: 'freeThrow',     kind: 'freeThrow', side: 'center', label: 'Free throw',       isThree: false },
  leftElbow:     { id: 'leftElbow',     kind: 'elbow',     side: 'left',   label: 'Left elbow',       isThree: false },
  rightElbow:    { id: 'rightElbow',    kind: 'elbow',     side: 'right',  label: 'Right elbow',      isThree: false },
  leftBaseline:  { id: 'leftBaseline',  kind: 'baseline',  side: 'left',   label: 'Left baseline',    isThree: false },
  rightBaseline: { id: 'rightBaseline', kind: 'baseline',  side: 'right',  label: 'Right baseline',   isThree: false },
  leftWing:      { id: 'leftWing',      kind: 'wing',      side: 'left',   label: 'Left wing',        isThree: false },
  rightWing:     { id: 'rightWing',     kind: 'wing',      side: 'right',  label: 'Right wing',       isThree: false },
  leftCorner3:   { id: 'leftCorner3',   kind: 'corner3',   side: 'left',   label: 'Left corner 3',    isThree: true },
  rightCorner3:  { id: 'rightCorner3',  kind: 'corner3',   side: 'right',  label: 'Right corner 3',   isThree: true },
  leftWing3:     { id: 'leftWing3',     kind: 'wing3',     side: 'left',   label: 'Left wing 3',      isThree: true },
  rightWing3:    { id: 'rightWing3',    kind: 'wing3',     side: 'right',  label: 'Right wing 3',     isThree: true },
  top3:          { id: 'top3',          kind: 'top3',      side: 'center', label: 'Top of the key 3', isThree: true },
};

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  paint: 'Paint', freeThrow: 'Free throw', elbow: 'Elbows', baseline: 'Baseline',
  wing: 'Wings', corner3: 'Corner 3s', wing3: 'Wing 3s', top3: 'Top of the key 3',
};

// ---------------------------------------------------------------- spots

export interface Spot {
  id: string;
  label: string;
  x: number;      // normalised court position
  y: number;
  zoneId: ZoneId;
}

const ft = (fx: number, fy: number) => ({ x: fx / COURT_WIDTH_FT, y: fy / COURT_DEPTH_FT });

// Left and right are the SHOOTER's, not the viewer's. She stands on the
// floor facing the basket; the court is drawn with the basket at the
// bottom, so she faces down the page and her left is the viewer's right.
// That's why every "left" spot sits at x > 25ft.
export const SPOTS: Record<string, Spot> = {
  layup:        { id: 'layup',        label: 'Layup',          ...ft(25, 8),     zoneId: 'paint' },
  leftBlock:    { id: 'leftBlock',    label: 'Left block',     ...ft(30.5, 8),   zoneId: 'paint' },
  rightBlock:   { id: 'rightBlock',   label: 'Right block',    ...ft(19.5, 8),   zoneId: 'paint' },
  freeThrow:    { id: 'freeThrow',    label: 'Free throw',     ...ft(25, 19),    zoneId: 'freeThrow' },
  leftElbow:    { id: 'leftElbow',    label: 'Left elbow',     ...ft(31, 19),    zoneId: 'leftElbow' },
  rightElbow:   { id: 'rightElbow',   label: 'Right elbow',    ...ft(19, 19),    zoneId: 'rightElbow' },
  leftBaseline: { id: 'leftBaseline', label: 'Left baseline',  ...ft(37, 7),     zoneId: 'leftBaseline' },
  rightBaseline:{ id: 'rightBaseline',label: 'Right baseline', ...ft(13, 7),     zoneId: 'rightBaseline' },
  leftWing:     { id: 'leftWing',     label: 'Left wing',      ...ft(35.6, 15.9),zoneId: 'leftWing' },
  rightWing:    { id: 'rightWing',    label: 'Right wing',     ...ft(14.4, 15.9),zoneId: 'rightWing' },
  // Corner spots sit a little beyond the arc — at exactly 19.75 ft they
  // land on the line and read as mid-range.
  leftCorner3:  { id: 'leftCorner3',  label: 'Left corner 3',  ...ft(45.5, 6.5), zoneId: 'leftCorner3' },
  rightCorner3: { id: 'rightCorner3', label: 'Right corner 3', ...ft(4.5, 6.5),  zoneId: 'rightCorner3' },
  leftWing3:    { id: 'leftWing3',    label: 'Left wing 3',    ...ft(39.1, 19.4),zoneId: 'leftWing3' },
  rightWing3:   { id: 'rightWing3',   label: 'Right wing 3',   ...ft(10.9, 19.4),zoneId: 'rightWing3' },
  top3:         { id: 'top3',         label: 'Top of the key', ...ft(25, 25.25), zoneId: 'top3' },
};

/** Distance from the hoop, in feet, for a normalised court position. */
export function distanceFt(x: number, y: number): number {
  const dx = (x - HOOP_X) * COURT_WIDTH_FT;
  const dy = (y - HOOP_Y) * COURT_DEPTH_FT;
  return Math.hypot(dx, dy);
}

/**
 * Which zone an arbitrary tap belongs to. Free-shooting mode records the
 * exact point for the chart and this zone for the stats, so a tapped shot
 * aggregates the same way a drill shot does.
 */
export function classifyZone(x: number, y: number): ZoneId {
  const dx = (x - HOOP_X) * COURT_WIDTH_FT;
  const dy = (y - HOOP_Y) * COURT_DEPTH_FT;
  // Shooter's left is the viewer's right — she faces the basket, which the
  // court draws at the bottom.
  const left = dx > 0;
  const dist = Math.hypot(dx, dy);
  // 0° = along the baseline, 90° = straight out from the hoop
  const angle = (Math.atan2(Math.max(dy, 0), Math.abs(dx)) * 180) / Math.PI;
  const fy = y * COURT_DEPTH_FT;

  if (dist >= THREE_PT_FT) {
    if (angle < 25) return left ? 'leftCorner3' : 'rightCorner3';
    if (angle > 65) return 'top3';
    return left ? 'leftWing3' : 'rightWing3';
  }
  if (fy < 17 && Math.abs(dx) <= LANE_HALF_FT) return 'paint';
  if (fy >= 17 && Math.abs(dx) <= 4) return 'freeThrow';
  if (fy >= 15 && Math.abs(dx) <= 10) return left ? 'leftElbow' : 'rightElbow';
  if (angle < 30) return left ? 'leftBaseline' : 'rightBaseline';
  return left ? 'leftWing' : 'rightWing';
}

// ---------------------------------------------------------------- drills

export type DrillPosition = 'any' | 'guard' | 'wing' | 'post';

export interface DrillStep {
  spotId: string;
  attempts: number;
}

export const DRILL_FORMAT = 'hardwoods.drill.v1';

export interface Drill {
  format: typeof DRILL_FORMAT;
  id: string;
  name: string;
  description?: string;
  position: DrillPosition;
  steps: DrillStep[];
  /** Pass threshold as a fraction, e.g. 0.7 for "make 70%". */
  target?: number;
  /** Set on drills a coach shared, so the UI can label them. */
  source?: string;
}

const drill = (
  id: string, name: string, position: DrillPosition,
  steps: [string, number][], target: number, description: string,
): Drill => ({
  format: DRILL_FORMAT, id, name, position, description, target,
  steps: steps.map(([spotId, attempts]) => ({ spotId, attempts })),
});

/** Alternating reps, e.g. the Mikan drill's left-right-left rhythm. */
function alternate(a: string, b: string, rounds: number): [string, number][] {
  return Array.from({ length: rounds * 2 }, (_, i) => [i % 2 === 0 ? a : b, 1]);
}

// Descriptions are instructions, not labels — a parent who has never run a
// shooting drill should be able to follow them cold.
export const BUILT_IN_DRILLS: Drill[] = [
  drill('form-shooting', 'Form Shooting', 'any',
    [['layup', 10], ['leftBlock', 10], ['rightBlock', 10]], 0.8,
    'Stand a step from the rim. Shoot with one hand, elbow under the ball, and hold the follow-through until it drops. Straight on first, then each block.'),
  drill('mikan', 'Mikan Drill', 'any',
    alternate('leftBlock', 'rightBlock', 10), 0.75,
    'Alternate layups on each side of the rim without letting the ball hit the floor. Shoot with the outside hand, catch your own rebound, step across, and go straight back up.'),
  drill('free-throw-ladder', 'Free Throw Ladder', 'any',
    [['freeThrow', 25]], 0.7,
    'Twenty-five from the line. Same routine before every shot — that repetition is the whole point.'),
  drill('mid-range-circuit', 'Mid-Range Circuit', 'any',
    [['leftBaseline', 10], ['leftWing', 10], ['freeThrow', 10],
     ['rightWing', 10], ['rightBaseline', 10]], 0.5,
    'Five spots inside the arc, ten shots each, working around from her left. She should be set and balanced before each shot.'),
  drill('elbow-to-elbow', 'Elbow to Elbow', 'any',
    [['leftElbow', 15], ['rightElbow', 15]], 0.5,
    'Fifteen from each elbow — the corners of the free-throw line. Catch, square her shoulders to the rim, shoot.'),
  drill('around-the-world-3', 'Around the World (3PT)', 'guard',
    [['leftCorner3', 5], ['leftWing3', 5], ['top3', 5],
     ['rightWing3', 5], ['rightCorner3', 5]], 0.35,
    'Five spots behind the arc, five shots each, moving corner to corner. Feet set behind the line before the catch.'),
  drill('corner-threes', 'Corner Threes', 'wing',
    [['leftCorner3', 15], ['rightCorner3', 15]], 0.35,
    'The shortest three on the floor. Watch her feet — the corner is where players step on the line without noticing.'),
  drill('post-finishing', 'Post Finishing', 'post',
    [['leftBlock', 10], ['rightBlock', 10], ['layup', 10]], 0.65,
    'From the blocks beside the rim. Finish over her outside shoulder on each side, then straight through the middle.'),
  drill('game-shots', 'Game Shots', 'any',
    [['layup', 5], ['freeThrow', 5], ['leftWing', 5],
     ['rightWing', 5], ['top3', 5]], 0.5,
    'A mixed bag at game speed — the shots that actually come up. Move between spots instead of standing and repeating.'),
];

export function drillTotalAttempts(d: Drill): number {
  return d.steps.reduce((sum, s) => sum + s.attempts, 0);
}

// -------------------------------------------------------------- sessions

export interface Shot {
  made: boolean;
  at: number;        // epoch ms
  x: number;         // normalised court position
  y: number;
  zoneId: ZoneId;
  spotId?: string;   // present for drill shots, absent for free shooting
  stepIndex?: number;
}

export interface Session {
  id: string;
  kidId: string;
  date: number;
  drillId?: string;   // absent = free shooting
  drillName?: string; // denormalised so history survives a deleted drill
  target?: number;
  shots: Shot[];
  completed: boolean;
}

export interface Line {
  made: number;
  attempted: number;
  pct: number | null;   // null when nothing was attempted
}

function line(made: number, attempted: number): Line {
  return { made, attempted, pct: attempted > 0 ? made / attempted : null };
}

export function sessionLine(shots: Shot[]): Line {
  return line(shots.filter(s => s.made).length, shots.length);
}

/** Per-zone breakdown, most attempts first — the coach-facing rollup. */
export function zoneLines(shots: Shot[]): { zone: Zone; line: Line }[] {
  const acc = new Map<ZoneId, { made: number; attempted: number }>();
  shots.forEach(s => {
    const e = acc.get(s.zoneId) ?? { made: 0, attempted: 0 };
    e.attempted += 1;
    if (s.made) e.made += 1;
    acc.set(s.zoneId, e);
  });
  return Array.from(acc.entries())
    .map(([id, e]) => ({ zone: ZONES[id], line: line(e.made, e.attempted) }))
    .sort((a, b) => b.line.attempted - a.line.attempted);
}

/** Coarser rollup that merges left and right — better for small samples. */
export function zoneKindLines(shots: Shot[]): { kind: ZoneKind; label: string; line: Line }[] {
  const acc = new Map<ZoneKind, { made: number; attempted: number }>();
  shots.forEach(s => {
    const kind = ZONES[s.zoneId].kind;
    const e = acc.get(kind) ?? { made: 0, attempted: 0 };
    e.attempted += 1;
    if (s.made) e.made += 1;
    acc.set(kind, e);
  });
  return Array.from(acc.entries())
    .map(([kind, e]) => ({ kind, label: ZONE_KIND_LABEL[kind], line: line(e.made, e.attempted) }))
    .sort((a, b) => b.line.attempted - a.line.attempted);
}

export function spotLine(shots: Shot[], spotId: string): Line {
  return sessionLine(shots.filter(s => s.spotId === spotId));
}

// ------------------------------------------------------- drill progress

export interface DrillProgress {
  stepIndex: number;        // which step is active
  step: DrillStep | null;
  spot: Spot | null;
  takenAtStep: number;
  attemptsAtStep: number;
  totalTaken: number;
  totalAttempts: number;
  complete: boolean;
}

/**
 * Where a session sits inside its drill. Steps advance once their
 * attempts are used up; extra shots stay on the last step rather than
 * overflowing, so a kid shooting a few extra doesn't corrupt the run.
 */
export function drillProgress(shots: Shot[], d: Drill): DrillProgress {
  const total = drillTotalAttempts(d);
  let remaining = shots.length;
  let stepIndex = 0;

  while (stepIndex < d.steps.length && remaining >= d.steps[stepIndex].attempts) {
    remaining -= d.steps[stepIndex].attempts;
    stepIndex += 1;
  }

  const complete = stepIndex >= d.steps.length;
  const step = complete ? null : d.steps[stepIndex];
  return {
    stepIndex: complete ? d.steps.length : stepIndex,
    step,
    spot: step ? SPOTS[step.spotId] ?? null : null,
    takenAtStep: complete ? 0 : remaining,
    attemptsAtStep: step ? step.attempts : 0,
    totalTaken: shots.length,
    totalAttempts: total,
    complete,
  };
}

/** null when the drill sets no target, or nothing was attempted. */
export function targetMet(shots: Shot[], target?: number): boolean | null {
  if (target == null) return null;
  const l = sessionLine(shots);
  return l.pct == null ? null : l.pct >= target;
}

export function formatPct(pct: number | null): string {
  return pct == null ? '—' : `${Math.round(pct * 100)}%`;
}

// ---------------------------------------------------------- coach import

export type DrillParse =
  | { ok: true; drill: Drill }
  | { ok: false; error: string };

/**
 * Validate a drill file a coach shared. Deliberately strict: a bad file
 * should produce a readable message, never a half-built drill that fails
 * mid-session at the gym.
 */
export function parseDrill(raw: unknown, source?: string): DrillParse {
  const d = raw as Partial<Drill>;
  if (!d || typeof d !== 'object') return { ok: false, error: 'That file is not a drill.' };
  if (d.format !== DRILL_FORMAT) {
    return { ok: false, error: 'Unrecognized drill format — it may be from a newer version of Hardwoods.' };
  }
  if (typeof d.name !== 'string' || !d.name.trim()) {
    return { ok: false, error: 'That drill has no name.' };
  }
  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    return { ok: false, error: 'That drill has no shooting spots.' };
  }
  for (const s of d.steps) {
    if (!s || typeof s.spotId !== 'string' || !SPOTS[s.spotId]) {
      return { ok: false, error: `Unknown shooting spot "${s?.spotId ?? '?'}".` };
    }
    if (!Number.isInteger(s.attempts) || s.attempts < 1 || s.attempts > 200) {
      return { ok: false, error: `"${SPOTS[s.spotId].label}" needs between 1 and 200 attempts.` };
    }
  }
  if (d.target != null && (typeof d.target !== 'number' || d.target <= 0 || d.target > 1)) {
    return { ok: false, error: 'Target must be a fraction between 0 and 1.' };
  }
  return {
    ok: true,
    drill: {
      format: DRILL_FORMAT,
      id: typeof d.id === 'string' && d.id ? d.id : `imported-${Date.now()}`,
      name: d.name.trim(),
      description: typeof d.description === 'string' ? d.description : undefined,
      position: (['any', 'guard', 'wing', 'post'] as const).includes(d.position as DrillPosition)
        ? (d.position as DrillPosition) : 'any',
      steps: d.steps.map(s => ({ spotId: s.spotId, attempts: s.attempts })),
      target: d.target,
      source,
    },
  };
}
