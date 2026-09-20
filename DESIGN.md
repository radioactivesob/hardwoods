# Hardwoods — design notes

Youth basketball scorekeeping and stat tracking, built by a parent for his
daughter's club team. Live on the App Store. Sibling app:
[Crosscourt](https://github.com/radioactivesob/crosscourt) (volleyball, same
architecture, deliberately different sport and palette).

Read this before changing anything. Most of what follows was learned by getting
it wrong at an actual gym. `ROADMAP.md` says where the app is going and why —
the short version is that Hardwoods is a **Growth Engine** joining game stats
to training drills, and the scorebooks are the extras.

---

## The constraint that shapes everything

**No accounts. No cloud. No analytics. Nothing leaves the phone unless a person
deliberately sends it.**

This isn't a preference. Apple rejected the first submission under Guideline
4.3(a) (spam — "similar to other apps"), and the appeal was won partly on the
app being genuinely distinct, privacy-first, and honestly described. The App
Privacy declaration says *Data Not Collected*, and it's true.

Any feature that would need a server, an account, or background sync is the
wrong shape for this app. Sharing happens by the user exporting a file and
sending it. Live sync across phones has been explicitly considered and rejected
on these grounds.

Free, no ads, no subscriptions. If monetisation ever happens it should be a
one-time unlock, never a subscription.

---

## Where things stand

Six modes, reachable from the landing page (`app/index.tsx`). **Stat tracking
leads; the scorebooks follow** — decided 2026-09-13 after a season of real use
showed My Kid and Team Stats are what the app is actually opened for, and the
official book is the extra.

| Mode | Screens | What it is |
|---|---|---|
| My Kid | `mykid`, `kidgame`, `kidseason`, `kidshare` | Track one player from the stands |
| Team Stats | `teamstats`, `teamroster`, `teamstatsgame`, `teamstatsshare`, `teamstatsedit`, `teamimport` | Every player on one roster, two taps per stat, box score for the coach |
| Training | `training`, `trainingrun`, `trainingresult`, `traininghistory` | Shooting drills with a tap-to-record court and shot charts |
| Full Scorebook | `scoreboard`, `scoring`, `scorebook`, `teams`, `rules` | The official book — both teams, fouls, periods, box score |
| Simple Scorebook | `simplegame` | Two teams, no roster, just the score |
| Team Seasons | `teamseasons` | Every archived team game — scorebook and Team Stats — with records and player averages |

**Team Stats is My Kid applied to a roster.** Same tap grid, same stat set
(configurable, stored on the saved team so a season's averages compare), same
event log, plus a strip of jersey numbers to pick who. The selection sticks, so
repeat stats for one player are one tap. `hooks/teamStats.ts` is the pure
bridge between the kid stat set and the scorebook's `PlayerStats`, in both
directions: `playerStatsFromTotals` for archiving, `eventsFromPlayerStats` for
sending a scorebook line into a My Kid profile.

**One roster, everywhere — and Team Stats owns editing it.** Both modes read
`hardwoods_team_library`; there is deliberately no second place to maintain a
team. Team Stats edits the saved team *directly* (`teamroster.tsx`, saving on
every keystroke) and has a + NEW TEAM path that never touches the scorebook.
The scorebook's Team Setup (`teams.tsx`) still works and still saves to the same
library, but it has a separate working copy and an explicit save step — the
step Cynthia forgot at a real game, which is why Team Stats no longer sends
anyone there. The game strip has an ADD chip for a girl who turns up
unannounced: adds her to the saved team and selects her.

**Strip and box score are in jersey order** (`byJersey` — numeric, unparseable
last, stable on ties). This replaced "reorder via the lineup" after the first
weekend; the FAQ was updated to match. Players marked OUT come off the strip
entirely and live behind a trailing OUT chip.

**Foul trouble tints the chip** (amber at 3, red at 4, greyed on 5 — `foulState`,
assuming the five-foul limit since Team Stats has no rules screen) and shooting
tiles show "4/9 · 44%" for the selected player. Both are read-only glances the
totals already support; neither adds a tap.

**Archived Team Stats games are editable** (`teamstatsedit.tsx`): adjust a count,
or move a whole line to the player it should have been under. Lines are rebuilt
from totals on every edit so `stats`, `totals` and `events` never disagree.
Scorebook games aren't editable there — they have their own ✎ EDIT in the book.

**Games flow into My Kid profiles from both team modes.** At end of game, any
rostered player whose name matches a profile on the phone gets the game offered
to their profile. From Team Stats that carries the full stat set; from the Full
Scorebook only shooting and fouls exist, so rebounds/steals/assists are
honestly absent rather than zero-filled. Matching is by trimmed, case-folded
name — the same rule `kidTransfer.matchProfile` uses.

**Players can be marked OUT for a night** (`Player.isOut`) without leaving the
roster. Out players are skipped by the bench picker, the box score, and the
archive, so their games-played count stays honest. The flag is per game and is
never written to the team library.

Plus `kidexport` / `kidimport` / `kidmanual` (game transfer between phones) and
`statsguide` (plain-English stat definitions).

**Check the live App Store version rather than assuming — TestFlight and public
releases drift apart:**

```
curl -s "https://itunes.apple.com/lookup?bundleId=com.hardwoods.scoreboard&country=us" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['results'][0]['version'])"
```

---

## Architecture

**Domain logic is pure.** `kidStats.ts`, `trainingStats.ts`, and `kidTransfer.ts`
contain types, geometry, and stat math with no React, no storage, and no I/O.
That's deliberate: they can be compiled standalone and exercised in node, which
is how the court geometry and the transfer merge logic were verified before any
UI existed.

```bash
./node_modules/.bin/tsc hooks/trainingStats.ts --ignoreConfig \
  --outDir /tmp/t --module commonjs --target es2020 --skipLibCheck
node -e "const T=require('/tmp/t/trainingStats.js'); /* assert things */"
```

That check caught a real bug — corner-3 spots sitting 0.25 ft inside the arc, so
they classified as mid-range. Worth doing for anything with geometry or merge
rules.

**Storage lives in `use*.ts` hooks** over AsyncStorage, with versioned keys:
`hardwoods_kids_v1`, `hardwoods_training_v1`, `hardwoods_team_games_v1`,
`hardwoods_team_library`, plus `*_inprogress` keys for crash recovery
(`hardwoods_teamstats_inprogress` included).

**Every store hook writes everything it holds.** `archiveGame`, `saveGame` and
friends do `set(prev => [...])` and persist the result — so calling one before
that hook has finished loading replaces the whole store with one entry. Screens
that save at the *end* of a long session are fine in practice; anything that
could save early must gate on the hook's `loading` flag (`teamstatsgame.tsx`
does).

**Event logs are the source of truth; totals are derived.** A game stores every
tap with a timestamp. That's what makes undo work, makes per-set and per-step
breakdowns possible, and gives transfers a content fingerprint. Manual entry
synthesises an event log from counts so hand-entered games behave like tracked
ones everywhere downstream.

**In-progress state persists on every tap.** A parent whose phone dies in the
third quarter loses nothing.

---

## Conventions

**Never import `Text` or `TextInput` from `react-native`.** Use
`components/AppText`. It caps `maxFontSizeMultiplier`, which is what keeps
layouts intact when someone runs large accessibility text. Importing directly
reintroduces a bug that made the app unusable for anyone with big text turned on.

**Screens holding lists must call `reload()` on focus.** Every screen calling
`useKidStats()` / `useTraining()` gets its *own* copy of the store, loaded at
mount. A screen sitting mounted underneath while another writes goes stale. Both
hooks expose `reload()`; call it from `useFocusEffect`. This bug shipped twice
before being understood.

**File formats are versioned from day one**, because they get shared between
devices and across app versions: `hardwoods.drill.v1` (coach-provided drills),
`hardwoods.kidgames.v1` (My Kid game transfer), `hardwoods.teamgame.v1` (a Team
Stats game — `hooks/teamTransfer.ts`). Parse strictly and return readable errors
— a bad file should never produce a half-merged season. **All of them share the
`.hardwoods` extension**, so iOS hands every file to `kidimport.tsx`, which
reads it once and routes on `format` — a team game goes to `teamimport.tsx` with
the JSON as a param. Add a fourth format there, not in `_layout.tsx`.

**A team game arriving offers each player's line to her profile**, using the
same `findProfileForPlayer` matching a live game uses, with the kid-side entry
id derived from `fingerprintGame` so it collides with a `kidgames` file of the
same game. That's the path by which one parent tracking the team feeds a kid's
season on another phone.

**Anything crossing devices needs content-derived ids.** Local ids are
`Date.now()` and differ per phone. Kid transfer fingerprints games by hashing
(player, date, opponent, event log); team transfer hashes (team, date, every
line's event log) and **deliberately leaves out the opponent and score**, since
both get corrected after the fact and a fixed-up game re-sent should still
dedup. The timestamped tap log is identity enough.

**Never read a value assigned inside a `setState` updater.** React runs the
updater later, so the outer function returns before it fires. `importGames`
reported "0 games added" for this reason while actually importing correctly —
compute the result from current state first, then call `update`.

**Uninstalling the app deletes everything.** All data is on-device by design, so
there is no recovery. Exporting from My Kid (`SELECT ALL` → share to yourself)
is the only backup, and is worth suggesting before anyone deletes or reinstalls.

**Undo names what it undoes** — "UNDO MISS — Left wing", not just "UNDO".

**Palette:** espresso `#1A0F00` / `#0D0700`, gold `#C8A040` / `#FFC93C`, muted
gold `#8B6914`, error red `#C25E5E`. Per-kid accent colours come from
`KID_COLORS`.

---

## Layout lessons

**Color emoji render larger than text glyphs.** 📋 and 👥 take noticeably more
room than ⚙ or ⌂, which broke both the admin bar and the My Kid action row —
the longest label wrapped to a second line and made its button taller than its
neighbours. Where a button label must fit, drop the color emoji and add
`numberOfLines={1} adjustsFontSizeToFit`.

**Dynamic Type goes to ~3x.** Fixed-size layouts shatter. `AppText` caps the
multiplier, but any single-line label (wordmarks, button text) also wants
`numberOfLines={1} adjustsFontSizeToFit` so it shrinks rather than wraps.

**Drill shots all share their spot's exact coordinate**, so plotting them as
individual dots stacks them invisibly. Drill results render one marker per spot
showing the percentage; free-shooting taps are genuinely distinct and plot as
dots. Two render modes because there are two kinds of data.

---

## Build and release

Node 22 (`nvm use 22`). The project **must not live in an iCloud-synced folder** —
iCloud tags files with metadata that makes codesign fail. It lives in
`~/Projects/hardwoods` for that reason.

**Cloud builds are a limited monthly resource** — the EAS free tier caps them,
and this is a hobby project that isn't going to pay for more. Don't cut a build
per fix. Batch changes and build when there's a release to make, or a change that
genuinely can't be checked any other way. Verify on the local simulator first;
it's free and it works.

```bash
npx expo-doctor                                    # before every build
npx eas-cli build --platform ios --profile production --non-interactive --no-wait
npx eas-cli submit --platform ios --latest --non-interactive
```

`eas build --platform ios --local` builds on this Mac instead, which does not
draw down the cloud build quota (it needs the working local Xcode toolchain and
the `LANG`/`LC_ALL` vars below). `eas submit` doesn't consume build credits.

`submit` uploads to App Store Connect and makes the build available in
TestFlight. It does **not** submit for App Review — that's a separate deliberate
action in App Store Connect. `ascAppId` is stored in `eas.json`, so submission
runs unattended.

Bump `expo.version` in `app.json`; build numbers auto-increment.

**App Store screenshots** are generated by `tools/make-screenshots.py` — it
frames raw simulator captures with captions on a branded background, and trims
the status bar. Sources live in `appstore/`, output in `appstore/marketing/`.

---

## Known gaps

- ~~Hermes memory regression in SDK 56.~~ Fixed by moving to SDK 57 / RN 0.86 in
  2.6.0. The upgrade was `npx expo install expo@^57 --fix` and nothing else — no
  source changes, `react-native-svg` and `react-native-view-shot` carried over,
  and `File.pickFileAsync` already used SDK 57's `{canceled, result}` shape.
  Public App Store releases still trail this, so anything at or below 2.3.1 in
  the wild carries the regression.
- **Coach export** (session/season data as PDF or CSV for a coach) — designed,
  deliberately deferred. Should reuse the `kidTransfer` machinery.
- **Shot sheets** — coaches hand out paper sheets ("400 Shots Sheet": 21 ordered
  drill entries, done over weeks, completed twice). Designed 2026-08-23, not
  built. The crux is that such a sheet counts **makes**, not attempts: `Drill`
  steps are `attempts: N` with `target` as a percentage, while the sheet means
  "shoot until 25 fall". Needs `goal: {type, value}` on a step, an assignment
  object containing ordered entries, and progress that accumulates across
  sessions instead of one sitting. Build the parent side first — entering a sheet
  by hand and tracking against it is the whole benefit and needs no coach. A
  coach-facing builder plus the return trip is an optional layer; `drill.v1` is
  already shareable (it has a `source` field), but collecting a squad's files
  back with no cloud and no roster view is where this fights the constraints.
- **AirDrop import can only be tested on real devices.** The document-type
  declarations in `app.json` (`UTExportedTypeDeclarations` /
  `CFBundleDocumentTypes` / `LSSupportsOpeningDocumentsInPlace`) can't be
  exercised in the simulator. Both directions were confirmed on two phones in
  2.5.2, over AirDrop and over text. Note `LSSupportsOpeningDocumentsInPlace`
  is deliberately `false` — Apple's ITMS-90737 warning suggests `YES`, but that
  is aimed at document-editing apps; we read a file once and merge it, so the
  copy-in behaviour of `NO` is both accurate and avoids needing security-scoped
  URL handling. Declaring `CFBundleDocumentTypes` without this key is a delivery
  warning and leaves the behaviour undefined.
- ~~`scoring.tsx` has no portrait layout.~~ Done 2026-09-13: the hub stacks
  Team A over Team B with a two-row admin bar, and the scoring screen puts the
  roster above the action panel. All picked off `useWindowDimensions`;
  landscape is unchanged.
- **Team Seasons' player table is tight in portrait** once the RPG/APG/SPG
  columns appear — names truncate to "Ava Mar…". Livable; a wider name column or
  last-name-only would fix it.
- **`useScreenOrientation` hooks are no-ops.** Orientation is handled by the
  Info.plist declarations plus per-screen layout. Fine in practice; means an
  iPad can show a landscape-designed screen in portrait.
- **The share sheet doesn't present in the simulator.** `Sharing.shareAsync`
  silently does nothing there, on both the image and file paths, so anything
  ending in a share sheet can only be confirmed on a real device.

---

## Verifying on the simulator

The simulator can be driven — taps and screenshots both work. Build and install
locally with:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios
```

The locale vars are not optional: Ruby 4.x's `unicode_normalize` rejects the
ASCII-8BIT path string CocoaPods passes it, and `pod install` dies before it
starts without them.

To reach a screen directly, seed state into AsyncStorage and deep-link to it.
Large values (the game archive, once it has a few games) are not inlined in
`manifest.json` — RCTAsyncLocalStorage spills them to sibling files named by
hash, so read the directory, not just the manifest.

**If another Expo project's Metro is on 8081**, this debug build will load its
bundle and show "Unmatched Route". The port is baked in at build time and
`--port` on `expo run:ios` doesn't reach the compiled React-Core pod. The fix is
the dev menu's backing store:

```bash
xcrun simctl spawn "$D" defaults write com.hardwoods.scoreboard RCT_jsLocation -string "localhost:8082"
```

then relaunch, with `npx expo start --port 8082` running here.

```bash
D="iPhone 17 Pro Max"
C=$(xcrun simctl get_app_container "$D" com.hardwoods.scoreboard data)
F="$C/Library/Application Support/com.hardwoods.scoreboard/RCTAsyncLocalStorage_V1/manifest.json"
# edit $F with python — values are JSON-encoded strings inside the manifest
xcrun simctl openurl "$D" "hardwoods://trainingresult?sessionId=..."
xcrun simctl io "$D" screenshot out.png
```

Terminate the app before writing storage, or it will overwrite your changes on
exit.
