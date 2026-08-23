# Hardwoods — design notes

Youth basketball scorekeeping and stat tracking, built by a parent for his
daughter's club team. Live on the App Store. Sibling app:
[Crosscourt](https://github.com/radioactivesob/crosscourt) (volleyball, same
architecture, deliberately different sport and palette).

Read this before changing anything. Most of what follows was learned by getting
it wrong at an actual gym.

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

Five modes, reachable from the landing page (`app/index.tsx`):

| Mode | Screens | What it is |
|---|---|---|
| Full Scorebook | `scoreboard`, `scoring`, `scorebook`, `teams`, `rules` | The official book — rosters, per-player stats, fouls, periods, box score |
| My Kid | `mykid`, `kidgame`, `kidseason`, `kidshare` | Track one player from the stands |
| Simple Scorebook | `simplegame` | Two teams, no roster, just the score |
| Training | `training`, `trainingrun`, `trainingresult`, `traininghistory` | Shooting drills with a tap-to-record court and shot charts |
| Team Seasons | `teamseasons` | Archived scorebook games, records, player season averages |

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
`hardwoods_team_library`, plus `*_inprogress` keys for crash recovery.

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
`hardwoods.kidgames.v1` (game transfer). Parse strictly and return readable
errors — a bad file should never produce a half-merged season.

**Anything crossing devices needs content-derived ids.** Local ids are
`Date.now()` and differ per phone. Transfer fingerprints games by hashing
(player, date, opponent, event log), which is what makes re-importing the same
file a no-op.

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

```bash
npx expo-doctor                                    # before every build
npx eas-cli build --platform ios --profile production --non-interactive --no-wait
npx eas-cli submit --platform ios --latest --non-interactive
```

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
- **`scoring.tsx` has no portrait layout.** Deliberately deferred (agreed
  2026-08-23). Full Scorebook's stat-entry screen splits 50/50 vertically in
  portrait: roster crammed into the left half above dead space, TEAM T/O and
  TECHNICAL stretched into full-height slabs on the right. The intended fix is
  the same shape `simplegame.tsx` now uses — roster across the top, the selected
  player's stat buttons across the bottom, picked off `useWindowDimensions`. It's
  the screen used during a live game, so it wants its own build. The Full
  Scorebook *hub* is fine in portrait and should be left alone; its admin bar is
  not — seven buttons plus the period button shrink to near-unreadable, and wants
  two rows.
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
