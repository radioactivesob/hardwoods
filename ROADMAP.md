# Hardwoods — roadmap

What's next and why, in order. `DESIGN.md` says how the app works; this says
where it's going. Dates are when a decision was made, not when it ships.

---

## The thesis (2026-09-20)

Hardwoods is a **Growth Engine**: it helps a parent or coach see where a kid
is improving, where she's behind, and what to do about it. The scorebooks are
useful extras. Everything below serves one loop:

> observe in a game → diagnose → prescribe a drill → practice → measure the
> next game

The two halves already speak the same language — My Kid records made/missed
2s, 3s and FTs per game; Training records the same shot types by zone — and
both key on the same kid profile. The join exists. What's missing is the view
over it, and the discipline to not lie with small numbers.

**Principles that don't bend:**

- **Sample-size discipline.** Youth games are ~10 attempts. Rolling windows of
  3–4 games, never one. Attempt thresholds (~20) before a trend appears.
  "Trending", not "improved". Never a flag from a single game. The app is more
  cautious than the parent.
- **No causation claims.** Practice and game timelines side by side; the
  parent draws the conclusion. The signal worth surfacing is the
  **practice–game gap closing** — that's what "it's transferring" looks like.
- **The game side stays coarse.** No shot location in My Kid. One tap per
  event is why it works from the stands. Games say *what*; training says
  *where*.
- **Tone: next thing to work on, never a grade.** A 12-year-old will see this
  screen. Every skill gets the same three things — where she is, where she's
  headed, what to do — so a weakness looks like every other row.
- **Sport-agnostic engine.** A skill is a game stat pair + a practice measure
  + a drill list. Crosscourt gets the engine with a different table.
- **Still no cloud.** Everything on device; files move by AirDrop.

---

## 2.8.0 — Team Stats after its first real weekend *(built, unshipped)*

Jersey order, foul tint, live shooting %, hidden OUT, Team Stats owns its
roster, archive editing, team game export/import, opponent fix-up, and
**playing time** in My Kid (ON THE FLOOR toggle; share of game leads).

To ship: TestFlight → verify with a second phone (share sheets and the
`.hardwoods` team-game import can't be exercised in the simulator) → App
Store with `appstore/whats-new-2.8.0.txt`.

---

## 2.9 — Data out *(next; prerequisite for everything after)*

**Training sessions can't leave the phone.** That's a backup hole — training
was the data lost when the app was deleted in August — and it's the reason
Evelyn's real practice data can't be used to build v3. Fix it first.

- `hardwoods.training.v1`: export a kid's training sessions (all, or a
  range) on the existing transfer machinery, with the same strict parse and
  content-derived dedup as games.
- **Whole-profile backup**: one file carrying the profile, every game, and
  every training session. "Back up Evelyn" on the profile; "Restore" on the
  Import path. This is the answer to "I deleted the app". It's also the file
  that gets copied into the simulator to develop v3 against.
- Same for Crosscourt, same session.

Small, mechanical, and it unlocks the rest.

---

## 3.0 — The Growth view *(read-only)*

One screen on the kid profile. Per skill — 2PT, 3PT, FT — the same three
things:

| | Source | Rule |
|---|---|---|
| **Where she is** | games | rolling last 3–4 games, shown only past the attempt threshold |
| **Where she's headed** | games + training | game trend, practice trend, and the gap between them |
| **What to do** | rules table | flag with its reason in one line, and the drills that target it |

The rules table is small and readable: FT% → Free Throw Ladder; 3PT% →
Corner Threes, Around the World; 2PT% → Form Shooting, Mid-Range Circuit,
Post Finishing. No new data capture — it's entirely a view over what exists.

**Build it against Evelyn's real export, not seeded data.** The thresholds
and window sizes can only be calibrated by looking at what the view says
about a real kid over a real season and asking whether it matches what her
parent and coach already know. If it flags what they already see, it works.
If it flags noise, the numbers move. Live with it for a few weeks before
anyone else sees it.

Engine shape, so Crosscourt can reuse it:

```ts
interface Skill {
  id: string;                 // 'ft'
  label: string;              // 'Free throws'
  game: { made: StatKey; missed: StatKey };
  practice: ZoneId[];         // which training zones count
  drills: string[];           // drill ids, in order of preference
  minAttempts: number;        // before anything is shown
}
```

---

## 3.1 — Close the loop

- **Start this drill** from a flag: one tap into Training with the drill
  preselected for that kid.
- **Since flagged**: sessions logged and practice % since the flag appeared,
  next to game % before and after — the side-by-side that lets a parent see
  transfer without the app claiming it.
- The season PDF gains a Growth page.

---

## 3.2 — Shot sheets (the prescribe step)

Coaches hand out paper sheets ("400 Shots Sheet": 21 ordered entries, done
over weeks). These count **makes**, not attempts — "shoot until 25 fall" —
which is a different runner loop from today's fixed-rep drills. Parent side
first: enter the sheet, track progress across sessions. A Growth flag can
hand the parent a sheet. See the design note in `DESIGN.md`.

---

## Parked — build only on demand

- **Coach mode** (builder UI, distribute sheets, collect sessions back). The
  return trip is N separate AirDrops with no roster view; it fights the
  no-cloud constraint hardest. Wait for a coach to ask.
- **Team Seasons coach export** (CSV/PDF). `expo-print` is already wired in
  `scorebook.tsx` and `kidseason.tsx`.
- **`scoring.tsx` portrait layout** in the Full Scorebook. Deferred by
  agreement; the stat-tracking modes come first.
- **Crosscourt parity**: everything above, plus the accessibility fix that's
  sitting unpushed on `drills-clips-recruiting`.

---

## Constraints that shape sequencing

- **Builds are scarce** (EAS free tier). One build per milestone, batched.
  Verify on the simulator; real devices for share sheets and AirDrop.
- **The public App Store lags TestFlight.** Check with the iTunes lookup in
  `DESIGN.md` rather than assuming.
- **Nothing here needs a server.** If a step seems to, it's the wrong step.
