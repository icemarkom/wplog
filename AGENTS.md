# wplog — Agent Handoff & Continuation Guide

## Project Summary

**wplog** is a water polo secondary game log — a client-side-only PWA (Progressive Web App) built with **Vanilla HTML/CSS/JS** (no npm, no build tools). It lets a coach or volunteer log game events poolside and produce an official-looking game sheet.

- **Repo**: `github.com/icemarkom/wplog`
- **Live**: `https://log.wpref.org/`
- **License**: Apache 2.0, copyright Marko Milivojevic
- **Tech**: Pure HTML/CSS/JS, no framework, no build step. No vendored libs.

---

## Architecture

```
wplog/
├── index.html          # App shell (overlays, nav, empty screen placeholders + async loader)
├── screens/
│   ├── setup.html      # Setup screen content (rules, date, teams, etc.)
│   ├── live.html       # Live log screen content (score bar, event buttons, log)
│   ├── modal.html      # Event modal content (time, cap, numpad)
│   ├── sheet.html      # Game sheet container
│   └── share.html      # Share screen content (QR code, print button)
├── css/
│   ├── style.css       # Dark-mode design system, mobile-first
│   ├── print.css       # Print-only B&W styles for game sheet
│   └── standalone.css  # Shared styles for standalone pages (privacy, help)
├── js/
│   ├── sanitize.js    # escapeHTML() utility — loaded first, used by sheet.js + events.js
│   ├── loader.js      # App shell loader — fetches screens, loads JS deps, inits app
│   ├── year.js        # Copyright year display (shared by all pages)
│   ├── config.js       # APP_VERSION + RULES definitions (USAWP, NFHS Varsity, NFHS JV)
│   ├── confirm.js      # Custom confirmation dialog (replaces native confirm())
│   ├── storage.js      # localStorage wrapper (with schema validation)
│   ├── game.js         # Core data model + game logic
│   ├── setup.js        # Setup screen (with active-game guards)
│   ├── events.js       # Live log screen (main UI)
│   ├── sheet.js        # Game sheet rendering (2-page print layout)
│   ├── share.js        # Share/Print functionality
│   └── app.js          # App init + screen navigation + version display
├── help.html           # Standalone help page (uses standalone.css)
├── sw.js               # Service worker (offline caching, version-keyed cache)
├── manifest.json       # PWA manifest (relative paths for GH Pages)
├── .github/
│   └── workflows/
│       └── deploy.yml  # Release-triggered deploy to gh-pages (injects version)
├── .agents/
│   └── workflows/
│       ├── branching.md # Branching strategy for parallel v1/v2 development
│       ├── geronimo.md  # "geronimo" = one-time approval to commit/push/close
│       └── kraken.md    # "kraken" = tag and release workflow
├── PRIVACY.md          # Privacy policy (Markdown, for GitHub)
├── privacy.html        # Privacy policy (HTML, canonical for OAuth consent)
└── lib/                # Empty (previously had vendored libs, now removed)
```

Script load order matters: `sanitize.js` → `config.js` → `confirm.js` → `storage.js` → `game.js` → `setup.js` → `events.js` → `sheet.js` → `share.js` → `app.js`

---

## Hosting & Deployment

- **GitHub Pages** serves from `gh-pages` branch (not `main`)
- **Production domain**: `https://log.wpref.org/` (via CNAME)
- **Stable releases** are on `main` — pushes do NOT affect the live site
- **v2 development** happens on `v2-dev` — a long-lived integration branch
- **v2 feature work**: branch off `v2-dev` as `v2/<name>`, merge back via PR
- **v1 hotfixes**: branch off `main`, fix, merge back, release. Then rebase `v2-dev` onto updated `main`
- **Releases** trigger the deploy Action: `gh release create v1.x.x --title "..." --notes "..."`
- Deploy Action injects the release tag version into `config.js` via `sed`, then uses `peaceiris/actions-gh-pages@v4` to copy files to `gh-pages`
- See `.agents/workflows/branching.md` for full branching strategy

---

## Key Design Decisions

These were explicitly discussed and agreed with the user:

| Decision | Detail |
|---|---|
| **No roster/player entry** | Cap numbers are entered per-event, not pre-game. No player names. |
| **Team names in UI vs reports** | UI always shows "White"/"Dark". Game sheet shows "White (Team Name)" when custom name set. |
| **Cap numbers are strings** | Support goalie modifiers: `"1A"`, `"1B"`, `"1C"` (max C). Input via 4-column numpad (digits + A/B/C column). |
| **Game clock time format** | `M:SS` (single-digit minutes). Digits fill right-to-left (S2→S1→M). Stored as `"4:53"`. NOT `MM:SS`. Max time is capped by period length (e.g., 8:00 for 8-min quarters). Start/end times are `HH:MM` (separate). |
| **`rules` not `competition`** | Field is named `rules` in the data model. Config constant is `RULES`. |
| **Period End code** | Uses `"---"` (non-alphanumeric) to avoid collision with real event codes. |
| **OT/SO mutually exclusive** | Only one can be enabled per game. |
| **Unlimited overtime** | OT1→OT2 mandatory pair. OT2+ tied → next OT (unlimited sudden victory). |
| **OT/Shootout per-game** | Rules provide defaults; setup screen has toggles to override per game. |
| **`autoFoulOut` is numeric** | `1` = immediate (MC, E-Game, BR), `2` = after 2nd occurrence (MAM in NFHS). Absent = none. |
| **`isPersonalFoul` flag** | Config-driven. Events with `isPersonalFoul: true` (E, P, P-E, MAM) count toward the shared `foulOutLimit`. MAM also has `autoFoulOut: 2` for dual-trigger (2nd MAM = immediate ejection). |
| **Period lengths** | Configurable per rule set (3-9 min dropdowns). `periodLength` for quarters, `otPeriodLength` for OT. SO has no period length (time locked to 0:00). |
| **Timeout tracking** | Configurable limits (full + TO30) in config, overridable in setup. TOL display in live view. Warning on over-limit. |
| **Game # replaces Rules on sheet** | Rules only relevant for setup; Game # shown on printed game sheet header. |
| **Print = Share** | `window.print()` is the sharing mechanism. Mobile print dialogs offer Save as PDF + native share. |
| **USAWP + NFHS supported** | USAWP, NFHS Varsity (7-min, OT, MAM), NFHS JV (6-min, no OT). NCAA to be added later. |
| **No `#` in Cap display** | Cap numbers shown without `#` prefix everywhere (modal, live log, sheet tables). |
| **Score on Goals only** | Score column in game log (live + sheet) only shows on Goal events. Other events leave it empty. |
| **Responsive modal** | Full-screen on mobile (default), fixed centered dialog on desktop (`@media min-width:900px and min-height:700px`). |
| **Numpad layout** | 4 columns: digits 1-9/0, A/B/C in rightmost column, backspace next to 0. |
| **Auto-close disabled** | GitHub auto-close via commit messages is disabled in this repo. Close issues manually with `gh issue close`. |
| **Don't commit without confirmation** | Always wait for user to confirm before committing and pushing. |
| **"Geronimo" workflow** | When user says "geronimo", it's one-time approval to commit, push, and close the relevant issue. Branch-aware: on long-lived feature branches, skip PR/merge. See `.agents/workflows/geronimo.md`. |
| **"Kraken" workflow** | When user says "kraken", triggers the release workflow: evaluate changes, update AGENTS.md, propose version, prepare release notes, tag and release. See `.agents/workflows/kraken.md`. |
| **Branching strategy** | v1 hotfixes branch off `main`; v2 uses short-lived `v2/<name>` branches off `v2-dev`. After v1 fixes land, rebase `v2-dev` onto `main`. See `.agents/workflows/branching.md`. |
| **Auto-clear on refocus** | Tapping a filled time/cap field in the modal auto-clears it for re-entry. Only on user clicks, not auto-advance. |
| **Custom dialogs** | All `confirm()` calls replaced with `ConfirmDialog` (overlay-based). Supports `danger` (red) and `warning` (amber) types. |
| **Version system** | `APP_VERSION = "dev"` in `config.js`. Deploy workflow injects the release tag. In dev, runtime auto-detects latest file modification timestamp via `Last-Modified` HTTP headers → displays `dev-YYYYMMDD-HHMM`. No git or build step needed at runtime. |
| **About dialog** | Overlay popup (not a screen) accessible via footer "About" link. Shows version, license, author, source link. |
| **SW cache = version** | Service worker cache name is `"wplog-" + APP_VERSION`. Each release busts stale caches automatically. |
| **SW dev vs prod** | Service worker uses network-first strategy in dev mode (no stale cache issues) and cache-first in production (offline reliability). |
| **QR code sharing** | Single SVG (`img/qr-wplog.svg`) with white modules on transparent background. CSS `filter: invert(1)` for high-contrast overlay. Share screen always accessible. |
| **Share tab always active** | Share tab is always enabled. Print Game Sheet button is disabled when no game is active. |
| **Help screen** | 5th nav tab (always enabled). Full screen section with concise quick-reference guide (~1 min read). Not a footer link or overlay — too undiscoverable. |
| **innerHTML sanitization** | All user-supplied values (team names, cap numbers, Game #, location, etc.) MUST be escaped via `escapeHTML()` from `sanitize.js` before `innerHTML` interpolation. Config-driven data (event names/codes) and internally computed values are safe but should still be escaped where mixed with user data. |
| **CSP meta tags** | `Content-Security-Policy` and `X-Content-Type-Options` meta tags in `<head>` of `index.html`, `privacy.html`, and `help.html`. No `'unsafe-inline'` for scripts — all scripts are external. `style-src` still allows `'unsafe-inline'` for inline styles. |
| **No inline scripts** | All JavaScript is in external files. `index.html` uses `js/loader.js` (app shell loader) and `js/year.js` (copyright year). Standalone pages use `js/year.js`. This enables strict CSP without `'unsafe-inline'` for `script-src`. |
| **localStorage validation** | `Storage.load()` validates parsed data shape (`rules` is string, `log` is array) before returning. Tampered/corrupt data is silently ignored. |
| **Stats are separate from log** | Live view: stats interleaved in recent events with teal accent. Game sheet: stats filtered from Progress of Game, shown in separate Player Stats section. |
| **Logging mode** | Foldable "Logging Mode" section on setup. Game Log + Stats checkboxes (mutual exclusion enforced). Stats Time Entry dropdown: Disabled / Optional / Required. Default time mode = Disabled for both hybrid and stats-only. |
| **Stats code = name** | Stats events omit `code` in config — auto-derived from `name`. Normalizer runs at load time for any event missing a code. Multi-word codes (e.g. "Field Block") are supported. |
| **Stats buttons teal** | Shot (S) and Assist (A) buttons styled with `color: "teal"` (`#2dd4bf`). Visual separator between log and stats buttons. |
| **Player Stats on sheet** | Single `<table>` per stat type with colspan White/Dark headers. Per-period columns (Q1, Q2, etc.) + bold Total. All events with cap numbers aggregated (not just statsOnly). Proper English pluralization for section titles. |
| **`statsOnly` flag** | Events with `statsOnly: true` skip foul-out checks, allow blank time, and are filtered from Progress of Game on sheet. |
| **`statsTimeMode`** | Controls time field in modal: `"off"` = hidden, `"optional"` = shown but not required, `"on"` = required. Stored in game data model. |

### USAWP Events

| Name | Code | Flags |
|---|---|---|
| Goal | `G` | `color: "green"` |
| Exclusion | `E` | `isPersonalFoul: true, color: "amber"` |
| Penalty | `P` | `isPersonalFoul: true, color: "amber"` |
| Timeout | `TO` | `noPlayer: true, color: "blue"` |
| Timeout 30 | `TO30` | `noPlayer: true, color: "blue"` |
| Yellow Card | `YC` | `color: "yellow"` |
| Penalty-Exclusion | `P-E` | `isPersonalFoul: true, color: "amber"` |
| Misconduct | `MC` | `autoFoulOut: 1, color: "red"` |
| Brutality | `BR` | `autoFoulOut: 1, color: "red"` |
| Red Card | `RC` | `color: "red"` |
| Game Exclusion | `E-Game` | `autoFoulOut: 1, color: "red"` |
| Shot | `S` | `statsOnly: true, color: "teal"` |
| Assist | `A` | `statsOnly: true, color: "teal"` |
| Steal | — | `statsOnly: true, color: "teal"` |
| Intercept | — | `statsOnly: true, color: "teal"` |
| Turnover | — | `statsOnly: true, color: "teal"` |
| Field Block | — | `statsOnly: true, color: "teal"` |
| Save | — | `statsOnly: true, color: "teal"` |
| Drawn Exclusion | — | `statsOnly: true, color: "teal"` |
| Drawn Penalty | — | `statsOnly: true, color: "teal"` |
| Sprint Won | — | `statsOnly: true, color: "teal"` |

### NFHS Events (Varsity & JV)

Same as USAWP plus:

| Name | Code | Flags |
|---|---|---|
| Minor Act | `MAM` | `isPersonalFoul: true, autoFoulOut: 2` |
| Flagrant Misconduct | `FM` | `autoFoulOut: 1` |

NFHS does not have Brutality. NFHS also includes Shot and Assist (same as USAWP).

---

## Current State (as of 2026-03-14)

### What's Done ✅
- Complete setup screen (rules, date, time, location, Game #, team names, OT/SO toggles, timeout overrides)
- Setup guards during active game (disable Start/rules, lock OT/SO if started, red END GAME button)
- Live-save of editable setup fields during active game
- Three rule sets: USAWP, NFHS Varsity, NFHS JV (with MAM + Flagrant Misconduct)
- Period length configuration (3-9 min dropdowns for quarters and OT)
- Time input capped to period length; SO locks time to 0:00
- Config-driven personal foul tracking (`isPersonalFoul` flag on E, P, P-E, MAM)
- Foul-out detection: accumulated personal fouls + auto-foul-out (MC, BR, E-Game, FM)
- MAM dual-trigger: counts as personal foul AND 2nd MAM = immediate ejection
- Live log with score bar, TOL display, period tabs, time input, team toggle, cap numpad
- All event types with event-first modal workflow (no event dropdown — title shows event)
- 4-column numpad (digits + A/B/C), right-to-left time input with `-:--` placeholder
- Auto-clear time/cap on refocus (user click only, not auto-advance)
- Event alignment framework (left/right/center per event in config)
- Period End / End Game logic (OT/SO aware, score-tie checks)
- Timeout tracking with configurable limits, TOL display, over-limit warnings
- Responsive event modal: full-screen on mobile, centered dialog on desktop
- Consistent element heights across modal (48px min-height for all interactive elements)
- Game sheet: progress of game, period scores, personal fouls, timeouts, cards
- Fractional SO scores (5.3–5.2 format, no floats — computed at render time)
- SO events display without time (always 0:00, redundant)
- Score column shows only on Goal events (live log + sheet)
- Print-friendly layout (US Letter, 2-page with page break, B&W)
- 3-row sheet header: Game#, Location, Date/Scheduled/Ended
- Share screen with Print Game Sheet button (`window.print()`)
- localStorage persistence
- PWA manifest + service worker (v2, relative paths)
- GitHub Pages deployment (release-gated via Actions)
- Dark mode, mobile-first CSS (Source Code Pro for scores/times/tables)
- Copyright footer with dynamic year
- Subdued placeholder color on native time input (`--:--`)
- "Geronimo" workflow for quick commit/push/close
- Custom confirmation dialog (`ConfirmDialog`) replacing all native `confirm()` calls
- Version display in footer (`APP_VERSION` with auto dev timestamp detection)
- About dialog (overlay popup from footer link: version, license, author, source)
- Service worker cache name tied to `APP_VERSION` for automatic cache busting
- Deploy-time version injection via `sed` in `deploy.yml`
- QR code on Share screen for app URL sharing (single SVG, CSS-controlled colors)
- Share tab always active; Print Game Sheet disabled without active game
- Tap-to-expand QR overlay: full-screen on mobile, dialog-sized on desktop, high-contrast (black on white)
- Service worker: network-first in dev, cache-first in production
- `.btn:disabled` styling matching nav tab pattern (opacity 0.3)
- "Kraken" workflow for version tagging and release
- Help screen: 5th nav tab with quick-reference guide (9 sections, always enabled)
- Privacy policy: standalone `privacy.html` + `PRIVACY.md`, linked from footer and About dialog
- File-per-screen architecture: `index.html` is app shell, content in `screens/*.html` loaded via async loader
- Shared `css/standalone.css` for standalone pages (`privacy.html`, `help.html`)
- Unified `.fetched-content` class for privacy + help content styles
- Shared `.overlay-title`/`.overlay-message` base classes for all overlay dialogs
- Consistent `letter-spacing: 0.04em` on all uppercase labels app-wide
- Consistent `opacity: 0.3` on all disabled elements
- Version link in About dialog: links to GitHub release page in production, plain text in dev
- Inline license display: clickable "Apache 2.0" in About opens scrollable license overlay
- Apache 2.0 copyright headers on all source files via `addlicense`
- `addlicense` enforcement in bazinga (pre-commit hook), geronimo, and kraken workflows
- Author name in About links to `https://icemarkom.dev/`
- Privacy link in About dialog as a row (Privacy: Policy), reordered: Version → License → Privacy → Source → Author
- Events sorted by game time within each period (`_sortLog` in `game.js`), with scores recalculated after sort
- HTML sanitization: `escapeHTML()` in `sanitize.js` applied to all user-controlled `innerHTML` interpolation in `sheet.js` and `events.js`
- CSP meta tag (`Content-Security-Policy`) + `X-Content-Type-Options: nosniff` on all HTML pages (`index.html`, `privacy.html`, `help.html`)
- Externalized all inline scripts: `js/loader.js` (app shell), `js/year.js` (copyright year) — CSP `script-src 'self'` only (no `'unsafe-inline'`)
- `localStorage` schema validation in `Storage.load()`
- `Referrer-Policy: strict-origin-when-cross-origin` meta tag on all HTML pages
- Favicon: water polo wave-splash W icon in 32px, 192px, 512px sizes (browser tab, PWA install, splash screen)
- Apple touch icon for iOS home screen
- Stats tracking PoC: Shot (S) and Assist (A) events with `statsOnly: true` and teal color
- Full stat types: Shot, Assist, Steal, Intercept, Turnover, Field Block, Save, Drawn Exclusion, Drawn Penalty, Sprint Won
- Stats events omit `code` in config — auto-derived from `name` at load time (applies to any event)
- Logging Mode foldable section on setup (Game Log / Stats toggles, Stats Time Entry dropdown)
- `statsTimeMode` handling in event modal: hide/show/optional time field
- Stats events interleaved in live log with teal accent and colored borders
- Game sheet: `statsOnly` events filtered from Progress of Game
- Game sheet: Player Stats section with per-period breakdown (Q1, Q2, etc.) and bold totals
- Single-table layout per stat type with colspan White/Dark headers
- All events with cap numbers aggregated in Player Stats (not just statsOnly)
- `seq` and `deviceTime` fields on log entries for ordering and future analysis
- Visual separator between log and stats buttons on live screen
- Cache-busting for dynamically loaded JS/screen assets in dev

### Known Gaps / Future Work 📋
- Stats feature is PoC — more stat types planned (steal, block, save, etc.)
- No NCAA rules yet (structure ready)
- No sprint tracking (user hasn't decided)
- No substitution tracking (user hasn't decided)
- Multi-game management not implemented (save/load multiple games)

- Service worker hasn't been tested offline
- `lib/` directory is empty and could be removed
- Issue #13 open: Add Additional Rule Sets (NFHS partially done, NCAA pending)
- Issue #24 open: Feature Design for v2.0.0


---

## How to Run

Serve locally with any static file server. The app has no build step.

```sh
python3 -m http.server 8080
# or
npx serve
```

Then open `http://localhost:8080`.

---

## Notes for Next Agent

1. **The user knows water polo deeply** — they're a coach/referee. Trust their domain knowledge on events, rules, and terminology.
2. **Keep it simple** — the user deliberately chose "no framework, no build tools." Honor that.
3. **Event codes** — the user specifically chose codes like `"E-Game"` (not abbreviated). Don't change them without asking.
4. **The user is iterative** — expect inline comments on artifacts with specific feedback. Incorporate exactly what they say.
5. **Don't commit/push without confirmation** — always wait for the user to say it's ready before `git commit` and `git push`. Exception: "geronimo" = one-time blanket approval.
6. **Close issues manually** — auto-close is disabled. Use `gh issue close N -c "comment"` after pushing.
7. **Release to publish** — stable releases from `main`. Use `gh release create` to deploy to GitHub Pages. See `.agents/workflows/branching.md` for the v1/v2 parallel development strategy.
8. **Previous conversations** exist about a full water polo scoreboard/timer controller (WTTC-1) — this is a separate, simpler project.
9. **Game clock is M:SS** — max time is capped by period length (not hardcoded 9:59). Right-to-left digit entry. Start/end times remain HH:MM.
10. **Modal uses responsive breakpoints** — default is full-screen (mobile), `@media (min-width: 900px) and (min-height: 700px)` switches to desktop dialog.
11. **Personal fouls are config-driven** — use `isPersonalFoul: true` on events. Don't hardcode event codes for foul counting.
12. **MAM is a dual-trigger event** — `isPersonalFoul: true` + `autoFoulOut: 2`. This pattern was explicitly designed for NFHS/NCAA.
13. **Version system** — `APP_VERSION` lives in `config.js`. Default is `"dev"`. Deploy workflow injects release tag. Dev mode auto-detects file timestamp via `HEAD` requests. Don't hardcode versions elsewhere.
14. **About is an overlay** — not a screen/section. It uses the same `.overlay` pattern as `ConfirmDialog` and the foul-out popup.
15. **Always use `escapeHTML()`** — when building `innerHTML` templates with user-supplied data (team names, cap numbers, Game #, location, etc.), wrap them in `escapeHTML()`. This is mandatory — see `sanitize.js`.
