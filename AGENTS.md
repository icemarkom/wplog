# wplog — Agent Handoff & Continuation Guide

## Rules for Next Agent

- **The user knows water polo deeply** — they're a referee. Trust their domain knowledge on events, rules, and terminology.
- **Keep it simple** — the user deliberately chose "no framework, no build tools." Honor that.
- **Event codes** — the user specifically chose codes like `"E-Game"` (not abbreviated). Don't change them without asking.
- **The user is iterative** — expect inline comments on artifacts with specific feedback. Incorporate exactly what they say.
- **Answer users's questions** — if the user asks a question, answer it. The user is seeking further understanding to make decisions. A question is not an instruction for you to do. It's an instruction for iteration. If the question is mixed with an instruction, determine whether to ask clarification on action, or do the action, but the question **must** be answered.
- **Do not commit/push without confirmation** — always wait for the user to say it's ready before `git commit` and `git push`. Exception: "geronimo" = one-time blanket approval.
- **Close issues manually** — auto-close is disabled. Use `gh issue close N -c "comment"` after pushing.
- **Release to publish** — stable releases from `main`. Use `gh release create` to deploy to GitHub Pages. See the `branching` skill (`.agents/skills/branching/SKILL.md`) for the branching strategy.
- **Game clock is M:SS** — max time is capped by period length (not hardcoded 9:59). Right-to-left digit entry. Start/end times remain HH:MM.
- **Modal uses responsive breakpoints** — default is full-screen (mobile), `@media (min-width: 900px) and (min-height: 700px)` switches to desktop dialog.
- **Personal fouls are config-driven** — use `isPersonalFoul: true` on events. Don't hardcode event codes for foul counting.
- **MAM is a dual-trigger event** — `isPersonalFoul: true` + `autoFoulOut: 2`. This pattern was explicitly designed for NFHS/NCAA.
- **Version system** — `APP_VERSION` lives in `config.js`. Default is `"dev"`. Deploy workflow injects release tag. Dev mode auto-detects file timestamp via `HEAD` requests. Don't hardcode versions elsewhere.
- **About is a native dialog** — not a screen/section. Uses native `<dialog>` element with `showModal()`/`close()`. All overlays (About, Confirm, Alert, Content, Download, Print, QR, Event Modal) are native `<dialog>` elements.
- **Always use `escapeHTML()`** — when building `innerHTML` templates with user-supplied data (team names, cap numbers, Game #, location, etc.), wrap them in `escapeHTML()`. This is mandatory — see `sanitize.js`.
- **Update sw.js ASSETS** — whenever adding a new file (HTML, CSS, JS, image) to the application, you MUST add it to the `ASSETS` array in `sw.js` to ensure the app continues to work completely offline.


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
├── index.html          # App shell (native dialogs, nav, empty screen placeholders + async loader)
├── screens/
│   ├── setup.html      # Setup screen content (rules, date, teams, etc.)
│   ├── live.html       # Live log screen content (score bar, event buttons, log)
│   ├── modal.html      # Event modal content (time, cap, numpad)
│   ├── sheet.html      # Game sheet container
│   ├── share.html      # Share screen content (QR code, print button)
│   └── help.html       # Help screen content (quick reference)
├── css/
│   ├── style.css       # Dark-mode design system, mobile-first
│   ├── print.css       # Print-only B&W styles for game sheet
│   └── standalone.css  # Shared styles for standalone pages (privacy, help)
├── js/
│   ├── sanitize.js    # escapeHTML() utility (ES module)
│   ├── loader.js      # App shell loader — fetches screens, imports app module, inits app
│   ├── year.js        # Copyright year display (standalone script, shared by all pages)
│   ├── config.js       # APP_VERSION + DEFAULTS + RULES definitions (USAWP, NFHS Varsity, NFHS JV, NCAA)
│   ├── confirm.js      # Custom confirmation dialog (replaces native confirm(), uses dialog.js)
│   ├── dialog.js       # Shared dialog utilities (initDialog — backdrop click + dismiss button)
│   ├── storage.js      # localStorage wrapper (with schema validation)
│   ├── game.js         # Core data model + game logic (pure — no Storage dependency)
│   ├── setup.js        # Setup screen (with active-game guards)
│   ├── events.js       # Live log screen (main UI, owns Storage.save after mutations)
│   ├── time.js         # Time parsing utilities (pure — no DOM, no game state)
│   ├── sheet.js        # Game sheet orchestrator + shared render helpers (imports Storage for inline roster edits)
│   ├── sheet-data.js   # Sheet data builders (pure — no DOM)
│   ├── sheet-screen.js # Game sheet screen rendering (2-page DOM layout)
│   ├── sheet-print.js  # Game sheet print rendering (DOM only — renders from pagination plans)
│   ├── pagination.js   # Print pagination engine (pure — no DOM)
│   ├── share.js        # Share/Print functionality
│   ├── export.js       # Export utilities — filename, CSV builders (pure — no DOM)
│   ├── roster.js       # Roster CSV parser, builder, merge logic (pure — no DOM)
│   └── app.js          # App init + screen navigation + version display
├── .agents/
│   ├── skills/
│   │   └── branching/
│   │       └── SKILL.md # Branching strategy skill (agentskills.io format)
│   └── workflows/
│       ├── bazinga.md   # "bazinga" = bootstrap new conversation
│       ├── geronimo.md  # "geronimo" = one-time approval to commit/push/close
│       └── kraken.md    # "kraken" = tag and release workflow
├── testdata/
│   ├── small-game.json     # NCAA Final test data (43 events)
│   ├── medium-game.json    # NCAA Semifinal test data (52 events)
│   └── large-game.json     # NFHS Varsity + OT test data (65 events)
├── tools/
│   └── serve.go           # Dev server (Go stdlib) — correct MIME types for ES modules
├── PRIVACY.md          # Privacy policy (Markdown, for GitHub)
└── privacy.html        # Privacy policy (HTML, canonical for OAuth consent)
```

All JS files (except `year.js`) use native ES modules with `import`/`export`. The browser resolves the dependency tree automatically from the entry point (`loader.js` → `app.js` → all other modules). `year.js` is a standalone `<script defer>` for copyright year display on all pages.

---

## Hosting & Deployment

- **GitHub Pages** serves from `gh-pages` branch (not `main`)
- **Production domain**: `https://log.wpref.org/` (via CNAME)
- **Stable releases** are on `main` — pushes do NOT affect the live site
- **All work** uses short-lived branches off `main`: `fix/<name>` for bugs, `feature/<name>` for enhancements
- **Releases** trigger the deploy Action: `gh release create vX.Y.Z --title "..." --notes "..."`
- Deploy Action injects the release tag version into `config.js` via `sed`, then uses `peaceiris/actions-gh-pages@v4` to copy files to `gh-pages`
- See the `branching` skill (`.agents/skills/branching/SKILL.md`) for full branching strategy

---

## Key Design Decisions

These were explicitly discussed and agreed with the user:

| Decision | Detail |
|---|---|
| **Roster is authoritative** | `game.white.roster` / `game.dark.roster` is the single source of truth for all known caps per team. Every logged cap is auto-registered in roster. CSV uploads merge into roster. Sheet reads only from roster. |
| **Team names in UI vs reports** | UI always shows "White"/"Dark". Game sheet shows "White (Team Name)" when custom name set. |
| **Cap numbers are strings** | Support goalie modifiers: `"1A"`, `"1B"`, `"1C"` (max C). Input via 4-column numpad (digits + A/B/C column). |
| **Game clock time format** | `M:SS` or `MM:SS` (dynamic 3 or 4 digits). Digits fill right-to-left. Stored as `"4:53"` or `"10:00"`. NOT rigid `MM:SS` for short periods. Max time capped by config (up to 20:00). Start/end times remain `HH:MM` (separate wall clock). |
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
| **System paper size** | Paper size and orientation are entirely system-controlled via the native OS/browser print dialog. Works beautifully on any standard paper geometry. |
| **Native CSS Print Layout** | 100% native CSS via `@media print`. No JS pagination or explicit layout math. Relies on standard browser flow with `break-inside: avoid` to gracefully preserve tabular data. |
| **Dynamic Print Chunking** | Player Stats matrix dynamically expands from 11 columns on-screen to 22 columns via `window.beforeprint`/`afterprint` hooks to maximize ink density at print time without breaking responsive layouts. |
| **USAWP + NFHS + NCAA supported** | USAWP (8-min default, 7-min, 6-min variants), NFHS Varsity (7-min, OT, MAM), NFHS JV (6-min, no OT), NCAA (8-min, OT, YRC). Additional rule sets added via inheritance. |
| **Rule set inheritance** | `inherits` key chains parent→child. `addEvents`/`removeEvents` directives for per-ruleset event list mutations. `_base` and `_academic` are internal (hidden from dropdown). `STATS_EVENTS` auto-appended to all rule sets. |
| **Cap flags** | `allowCoach`, `allowAssistant`, `allowBench` enable C/AC/B cap values. `allowPlayer` (default true) can be set false to block digit input. `allowNoCap` allows submitting without cap. `teamOnly` (renamed from `noPlayer`) hides cap field entirely. |
| **`allowOfficial` flag** | Config-driven flag (valid on `teamOnly` events only). Shows a third "OFFICIAL" team toggle button in the modal. Selecting it stores `team: ""` — no new team code. TOL counting naturally excludes official timeouts. `O` keyboard shortcut. Button order: WHITE → OFFICIAL → DARK (Dark stays rightmost for muscle memory). |
| **No `#` in Cap display** | Cap numbers shown without `#` prefix everywhere (modal, live log, sheet tables). |
| **Score on Goals only** | Score column in game log (live + sheet) only shows on Goal events. Other events leave it empty. |
| **Responsive modal** | Compact content-sized on mobile (default), fixed centered 480px dialog on desktop (`@media min-width:900px and min-height:700px`). Numpad button height capped at 72px for landscape aspect ratio. |
| **Numpad layout** | 4 columns: digits 1-9/0, A/B/C in rightmost column, backspace next to 0. |
| **Auto-close disabled** | GitHub auto-close via commit messages is disabled in this repo. Close issues manually with `gh issue close`. |
| **Don't commit without confirmation** | Always wait for user to confirm before committing and pushing. |
| **"Geronimo" workflow** | When user says "geronimo", it's one-time approval to commit, push, and close the relevant issue. Branch-aware: on long-lived feature branches, skip PR/merge. See `.agents/workflows/geronimo.md`. |
| **"Kraken" workflow** | When user says "kraken", triggers the release workflow: evaluate changes, update AGENTS.md, propose version, prepare release notes, tag and release. See `.agents/workflows/kraken.md`. |
| **Help docs as delivery** | User-facing documentation (`help.html`) is part of feature delivery. Bazinga establishes the principle; geronimo and kraken enforce it with check steps. |
| **Branching strategy** | Single-track: all work uses short-lived `fix/<name>` or `feature/<name>` branches off `main`. No parallel development branches. See the `branching` skill (`.agents/skills/branching/SKILL.md`). |
| **Auto-clear on refocus** | Tapping a filled time/cap field in the modal auto-clears it for re-entry. Only on user clicks, not auto-advance. |
| **Custom dialogs** | All UI overlays use native HTML5 `<dialog>` elements with `showModal()`/`close()`. Shared `initDialog()` utility in `dialog.js` handles backdrop-click-to-close and dismiss-button wiring. No manual z-index, `.visible` class toggling, or position:fixed stacking. |
| **Version system** | `APP_VERSION = "dev"` in `config.js`. Deploy workflow injects the release tag. In dev, runtime auto-detects latest file modification timestamp via `Last-Modified` HTTP headers → displays `dev-YYYYMMDD-HHMM`. No git or build step needed at runtime. |
| **About dialog** | Native `<dialog>` popup (not a screen) accessible via footer "About" link. Shows version, license, author, source link. Privacy and License open as stacked content dialogs on top. |
| **SW cache = version** | Service worker cache name is `"wplog-" + APP_VERSION`. Each release busts stale caches automatically. |
| **SW dev vs prod** | Service worker uses network-first strategy in dev mode (no stale cache issues) and cache-first in production (offline reliability). |
| **Interactive SW Updates** | `sw.js` safely idles downloaded updates in the `waiting` queue until the UI commands otherwise. `js/loader.js` tracks `updatefound` hooks to generate a native `popover` Toast prompting the user. Clicking 'Reload' signals `skipWaiting` via `postMessage` and instantly reboots `wplog` into the new cache layer seamlessly, avoiding aggressive auto-refreshes that clear out midway data entry. |
| **QR code sharing** | Single SVG (`img/qr-wplog.svg`) with white modules on transparent background. CSS `filter: invert(1)` for high-contrast overlay. Share screen always accessible. |
| **Share tab always active** | Share tab is always enabled. Print Game Sheet button is disabled when no game is active. |
| **Help screen** | 5th nav tab (always enabled). Full screen section with concise quick-reference guide (~1 min read). Loaded at boot alongside all other screen fragments. |
| **innerHTML sanitization** | All user-supplied values (team names, cap numbers, Game #, location, etc.) MUST be escaped via `escapeHTML()` from `sanitize.js` before `innerHTML` interpolation. Config-driven data (event names/codes) and internally computed values are safe but should still be escaped where mixed with user data. |
| **CSP meta tags** | `Content-Security-Policy` and `X-Content-Type-Options` meta tags in `<head>` of `index.html` and `privacy.html`. No `'unsafe-inline'` for scripts — all scripts are external. `style-src` still allows `'unsafe-inline'` for inline styles. |
| **No inline scripts** | All JavaScript is in external files. `index.html` uses `js/loader.js` (app shell loader) and `js/year.js` (copyright year). Standalone pages use `js/year.js`. This enables strict CSP without `'unsafe-inline'` for `script-src`. |
| **localStorage validation** | `Storage.load()` validates parsed data shape (`rules` is string, `log` is array) before returning. Tampered/corrupt data is silently ignored. |
| **Stats are separate from log** | Live view: stats interleaved in recent events with teal accent. Game sheet: stats filtered from Progress of Game, shown in separate Player Stats section. |
| **Logging mode** | Collapsible section on setup screen with mode segmented control (Game Log Only / Both / Stats Only) and Stats Time Entry (Disabled / Optional / Required). Summary shown in foldable header. |
| **Stats code = name** | Stats events omit `code` in config — auto-derived from `name`. Normalizer runs at load time for any event missing a code. Multi-word codes (e.g. "Field Block") are supported. |
| **Stats buttons teal** | All stats buttons styled with `color: "teal"` (`#2dd4bf`). Visual separator between log and stats buttons. |
| **Player Stats on sheet** | Inverted team-centric matrix layout. Teams form sections (White / Dark), Cap numbers form rows (Y-axis), and individual Stat categories form columns (X-axis). Grouped strictly into chunks of 11 stat columns padded with `null` structurally to form identical repeating 100% width tables without distorting CSS sizing properties. All events with cap numbers aggregated. |
| **`statsOnly` flag** | Events with `statsOnly: true` skip foul-out checks, allow blank time, and are filtered from Progress of Game on sheet. |
| **`statsTimeMode`** | Controls time field in modal: `"off"` = hidden, `"optional"` = shown but not required, `"on"` = required. Stored in game data model. |
| **ES modules** | All JS files use native `import`/`export` (except `year.js` which is a standalone `<script defer>`). `loader.js` is loaded as `<script type="module">` and imports `app.js`, which imports all other modules. The browser resolves the dependency tree automatically — no manual load ordering. Service worker also uses `import` for `APP_VERSION` from `config.js`. |
| **Home/Away designation** | `homeTeam` is a rule-set property in `config.json` (`_base` defaults to `"W"`, `_academic` overrides to `"D"`). Setup screen shows a ⇄ flip button to override per-game. Flip is locked during active games. All display surfaces (score bar, sheet header, Score by Period, Player Stats, CSV filename) render Home team first, Away second. Event modal button order (W/D) is fixed for muscle memory. |
| **`DEFAULTS` object** | Centralized fallback defaults in `config.js` for all rule-set properties (`periods`, `periodLength`, `foulOutLimit`, `homeTeam`, `overtime`, `shootout`, `timeouts`, `events`, `statsEvents`). Used by `_getSafeMode()` and the normalization block. Eliminates scattered magic numbers. |
| **Setup labels** | Team input labels show `"$location Team ($color)"` format — e.g., "Home Team (White)", "Away Team (Dark)". |
| **Edit-in-place** | Tap any event in the game log to open the modal pre-filled with existing values (time, cap, team, period). Event type is NOT changeable — delete and re-add. Period-end events are NOT editable. OK button shows "Save" in edit mode. Foul-out popup fires if editing causes a foul-out. "Event updated" toast confirms the action. |
| **Period selector in modal** | Row of `.team-btn` pills above the time field. Shows all periods up to `currentPeriod`. New events default to current period; user can tap a previous period to log missed events. Edits show the event's existing period. Hidden when only one period available. |
| **Full game log** | Live log shows ALL events (not capped at 15), grouped by period headers using `.log-title` typography. Period headers act as visual separators. Title changed from "Recent Events" to "Game Log". |
| **CSS reuse over proliferation** | New interactive elements reuse existing CSS classes (`.team-btn` for period pills, `.log-title` for period headers, structural `:not()` selectors for tappable entries) rather than introducing new class names. Scoped overrides via `#id .existing-class`. |
| **"Add Name" button** | Grey button on Live screen (alongside Swap Caps and End Period) that opens the event modal in roster-only mode: team + cap + name/ID fields, no time, no period selector, no event logged. Saves directly to `game[teamKey].roster[cap]`. Order: Add Name → Swap Caps → End Period. All three follow a `.stats-separator` and auto-flow into the 3-column grid. |
| **Tappable roster rows** | On the Game Sheet screen, roster rows are tappable to edit name/ID inline. Tap → static text replaced with `<input>` → blur/Enter saves + `Storage.save()` + re-renders roster section. Escape reverts. Print layout stays static. |

---

## Current State (as of 2026-04-08)

### What's Done ✅
- Inline styles elimination (#203): Migrated all inline `style="..."` attributes from HTML (modal.html, setup.html, help.html) and all `element.style.*` JS manipulation (events.js, setup.js, share.js) to CSS classes. Two utility classes (`.hidden`, `.disabled`) + scoped ID rules. Zero inline styles remain in the codebase.
- Inline roster editing: "Add Name" grey button on Live screen opens modal in roster-only mode (team + cap + name, no event logged). Roster rows on the Game Sheet are tappable to edit name/ID inline with blur/Enter save. Separator above grey action buttons row. Help docs updated.
- Edit-in-place (#23): Tap any event in the game log to edit its time, cap, team, or period. Period selector pills in the modal allow logging missed events in previous periods. Full game log with period grouping replaces the 15-event limit. Foul-out detection on edits. Uses existing `.team-btn` and `.log-title` CSS — zero new class names.
- Roster CSV bulk management: upload (⬆ button on Setup, inline with team name inputs) and download (Share screen with team selection dialog). CSV parser handles HC→C alias, rejects B caps, warns on duplicates (first wins). Pre-game uploads buffered and applied at game start. Roster is the single authoritative source — every logged cap auto-registers.
- Fixed stats format reverting bug: Refactored the native print sequence in `js/share.js` and `js/app.js` to decouple overriding logic out of fragile inline listeners and safely route them through persistent global hooks via `Share.printOptions`, handling continuous Safari orientation regeneration natively.
- Cap Swap persistence integration: Added 'Cap swap' into internal storage validation allowlists automatically protecting structural tracking across PWA loads natively ensuring continuity over structural cache layers stably resolving event UI.
- Time Engine Restructure: Internally transitioned time structures globally natively out into numerical integer intervals exclusively handling math mapping instead of formatted sequences implicitly bypassing edge-case comparison blocks across rules dynamically.
- Sequential UI Organization limit mapping globally decoupled native runtime limits using implicitly executed execution structures scaling `a.seq - b.seq` mappings over chronology overrides safely.
- Supported Halves and dynamic period configs via a new Setup Periods stepper, replacing hardcoded Quarter logic and safely updating Player Stats layout chunking math.
- Globally centered table headers (`vertical-align: middle`) and safely insulated bottom alignments on vertical stats headers using CSS specificity.
- Fixed a timing race condition in the Print Dialog on mobile browsers (specifically iOS Safari) by leveraging the native `window.afterprint` event, ensuring hidden CSS print classes reliably persist through asynchronous PDF generation.
- Integrated Screen Wake Lock API to prevent devices from sleeping during active games when on the Live screen.
- Added new Rebound statistic tracking.
- Implemented interactive Service Worker Update flow: the app now traps background updates in `waiting` state and drops an explicit *Update Available* popover Toast on-screen to gracefully force a controlled UI refresh, preventing mixed-version ghosts.
- Migrated global toast notifications to use the native HTML5 `popover="manual"`, bypassing dialog `z-index` isolation contexts directly via the browser's Top Layer.
- Cap swaps support Unidirectional (replacement) and Bidirectional (trade) modes with Retired Caps validation for identity tracking.
- Added specific explicit Light Theme toggle (System / Dark / Light) in Setup screen. Uses OS `prefers-color-scheme` tracking via `mathMedia` when set to `system` natively updating `data-theme` without repeating CSS.
- Re-architected Theme toggle and Restart App controls into an adjacent `.inline-menu` container.
- Dynamic 10+ minute game clock support natively scales Numpad limit/UI dash format between 3-digit `M:SS` and 4-digit `MM:SS` modes depending on rule set, expanding config boundaries up to 20-minute periods/halves.
- Externalized application configuration (`config.json`): decoupled game rules, events, and stats taxonomies from hardcoded application logic using an asynchronous boot loader.
- Replaced JS-based pagination logic with a clean, fully native CSS `@media print` pipeline.
- Added intelligent JavaScript print hook via `window.beforeprint`/`window.afterprint` to dynamically broaden the Player Stats matrix from 11 columns on screen to 22 columns on printed page without breaking responsive structure.
- CSS consolidation: Eliminated obsolete CSS filter hacks, adopted explicit `--accent-blue`/`--text-on-accent` design tokens for native theme readiness, and stripped defunct `.toggle-row` selectors.
- Unified `.dialog-card` styling architecture eliminating duplicate popup layouts.
- Native `<dialog>` migration: all 9 overlays converted from custom `<div class="overlay">` to native `<dialog>` elements with `showModal()`/`close()`, eliminating manual z-index stacking, `.visible` class toggling, and position:fixed management.
- Shared `initDialog()` utility in `dialog.js`: centralizes backdrop-click-to-close and dismiss-button wiring — used by 6 dialogs (About, Content, Alert, Confirm, Download, Print).
- Privacy and License dialogs consolidated into a single reusable `content-dialog` with cached content fetching — stacks natively on top of About dialog.
- Compact event modal on mobile: content-sized height (no forced 100dvh), numpad buttons capped at 72px for landscape aspect ratio.
- Modal auto-focus fix: `tabindex="-1" autofocus` on content wrapper absorbs `showModal()` focus, preventing spurious focus rings on first button.
- Dynamic SVG Injection: Replaced static `<img>` tags with asynchronous `DOMParser("image/svg+xml")` instantiations to bypass iOS Safari namespace bugs and support native `fill` targeting.
- Ghost text interactive inline toggles for Player Stats view (`CUMULATIVE / PER PERIOD`), dynamically synced with Print dialog state and natively stripped during CSS printing.
- Complete setup screen (rules, date, time, location, Game #, team names, OT/SO toggles, timeout overrides)
- Player Stats grid refactored into a scalable inverted matrix (teams as sections, cap=Y-axis, stats=X-axis), chunked into perfectly padded 11-column widths that natively span to the right margin.
- Setup guards during active game (disable Start/rules, lock OT/SO/period config/timeouts/logging mode, red END GAME button)
- Live-save of editable setup fields during active game
- Four rule sets: USAWP, NFHS Varsity, NFHS JV, NCAA (via inheritance-based config system)
- Rule set inheritance: `_base`/`_academic` internal bases, `inherits`, `addEvents`/`removeEvents` directives
- `STATS_EVENTS` array auto-appended to all rule sets
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
- Cap flags: `allowCoach`, `allowAssistant`, `allowBench`, `allowPlayer` (default true), `allowNoCap`
- `allowOfficial` flag: third "OFFICIAL" team toggle for team-neutral events (e.g., referee/media timeouts), stores `team: ""`
- `teamOnly` flag (renamed from `noPlayer`) hides cap field entirely for team-level events
- Period End / End Game logic (OT/SO aware, score-tie checks)
- Timeout tracking with configurable limits, TOL display, over-limit warnings
- Responsive event modal: full-screen on mobile, centered dialog on desktop
- Consistent element heights across modal (48px min-height for all interactive elements)
- Game sheet: progress of game, period scores, personal fouls, timeouts, cards
- Fractional SO scores (5.3–5.2 format, no floats — computed at render time)
- SO events display without time (always 0:00, redundant)
- Score column shows only on Goal events (live log + sheet)
- Native print delegation: directly calls `window.print()` bypassing custom configuration (paper size/geometry is entirely system-controlled)
- Game header on every printed page (measured at 192px = 12 rows)
- 3-row sheet header: Game#, Location, Date/Scheduled/Ended
- Share screen with Print Game Sheet button and Download CSV button
- localStorage persistence
- PWA manifest + service worker (v2, relative paths)
- GitHub Pages deployment (release-gated via Actions)
- Dark mode, mobile-first CSS (native system fonts for scores/times/tables)
- Copyright footer with dynamic year
- Subdued placeholder color on native time input (`--:--`)
- "Geronimo" workflow for quick commit/push/close
- Custom confirmation dialog (`ConfirmDialog`) replacing all native `confirm()` calls
- Version display in footer (`APP_VERSION` with auto dev timestamp detection)
- About dialog (native `<dialog>` popup from footer link: version, license, author, source)
- Service worker cache name tied to `APP_VERSION` for automatic cache busting
- Deploy-time version injection via `sed` in `deploy.yml`
- QR code on Share screen for app URL sharing (single SVG, CSS-controlled colors)
- Share tab always active; Print Game Sheet disabled without active game
- Tap-to-expand QR overlay: full-screen on mobile, dialog-sized on desktop, high-contrast (black on white)
- Service worker: network-first in dev, cache-first in production
- `.btn:disabled` styling matching nav tab pattern (opacity 0.3)
- CSS utility classes: `.hidden` (display:none) and `.disabled` (opacity:0.5, pointer-events:none) replace all inline `style.*` manipulation in JS and inline `style="..."` attributes in HTML. All visibility/state toggling uses `classList.toggle()` exclusively.
- "Kraken" workflow for version tagging and release
- Help screen: 5th nav tab with quick-reference guide (9 sections, always enabled), includes keyboard shortcut tip
- Privacy policy: standalone `privacy.html` + `PRIVACY.md`, linked from footer and About dialog
- File-per-screen architecture: `index.html` is app shell, content in `screens/*.html` loaded via async loader
- Shared `css/standalone.css` for standalone pages (`privacy.html`, `help.html`)
- Unified `.fetched-content` class for privacy + help content styles
- Shared `.overlay-title`/`.overlay-message` base classes for dialog content
- Consistent `letter-spacing: 0.04em` on all uppercase labels app-wide
- Consistent `opacity: 0.5` on `.disabled` utility class (replaces inline style toggles)
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
- Form label associations: all `<input>`/`<select>` use `for`/`id`; custom widgets (segment controls, steppers) use `aria-labelledby`; `.sr-only` utility class for visually-hidden labels
- Favicon: water polo wave-splash W icon in 32px, 192px, 512px sizes (browser tab, PWA install, splash screen)
- Apple touch icon for iOS home screen
- Full stats tracking: 12 stat event types (Shot, Assist, Offensive, Steal, Intercept, Turnover, Field Block, Save, Drawn Exclusion, Drawn Penalty, Sprint Won, Rebound)
- Stats events omit `code` in config — auto-derived from `name` at load time (applies to any event)
- Logging Mode as collapsible section on setup with segmented control (Game Log Only / Both / Stats Only) and Stats Time Entry
- Three logging modes: Game Log only, Stats only, Full (Game Log + Stats)
- `statsTimeMode` handling in event modal: `"off"` = hidden, `"optional"` = shown but not required, `"on"` = required
- Stats-only mode respects `statsTimeMode` for all events (not just `statsOnly` events)
- Stats-only mode: all buttons shown in uniform teal
- Full mode: log buttons in event colors, separator, stats buttons in teal
- Stats events interleaved in live log with teal accent and colored borders
- Game sheet: `statsOnly` events filtered from Progress of Game
- Game sheet: Player Stats section with per-period breakdown (Q1, Q2, etc.) and bold totals
- Single-table layout per stat type with colspan White/Dark headers
- All events with cap numbers aggregated in Player Stats (not just statsOnly)
- `seq` and `deviceTime` fields on log entries for ordering and future analysis
- Visual separator between log and stats buttons on live screen
- Cache-busting for dynamically loaded JS/screen assets in dev
- Help screen updated with stats tracking section
- Keyboard input in event modal: digits, A/B/C, W/D team, Backspace, Tab, Enter, Escape
- Branching workflow converted to agentskills.io skill (`.agents/skills/branching/SKILL.md`)
- Setup screen progressive disclosure: essentials always visible (Rules, Teams), Game Details, Game Setup, and Logging as collapsible sections, Start Game at bottom
- Single-track branching model (post-v2): all work off `main`, `v2-dev` retired
- Test data: real game data files (`testdata/small-game.json`, `testdata/medium-game.json`, `testdata/large-game.json`) for NCAA and NFHS rule sets
- CSV export: Download CSV button on Share screen with editable filename dialog (date + teams + time)
- JSON export: Download Game Data button on Share screen (compact JSON, shared filename dialog with CSV)
- Load Game: button on Setup screen (visible when no game active), file picker for JSON, 5-layer validation
- Input validation: `validateGameData()` in `storage.js` — file size limit (128 KB), schema checks, property stripping, allowlisted fields only
- Error dialog for invalid load files (alert-dialog pattern with specific error messages)
- Screen persistence: active screen restored across page reloads via `sessionStorage`
- Game Setup section uses stepper controls for period length, OT length, and timeout limits (with ∞ option)
- Stepper boundary protection: dec disabled at min, inc disabled at max (non-unlimited), defensive min/max guards in click handlers, init ordering ensures disable states aren't overwritten
- Post-regulation as segmented control (None / Overtime / Shootout) in Game Setup
- Foldable section summaries: Logging header shows current mode, Game Setup header shows period length + OT + timeout config
- Restart App link below Start Game: clears localStorage, unregisters service workers, purges caches, and reloads
- End Period button moved from score bar to event grid: same size as event buttons, `grid-column: 3` pins it to rightmost column
- End Game button disables after press: shows "Game Over" and prevents duplicate end-of-game events
- Native ES modules: all JS files use `import`/`export` (except `year.js`). `loader.js` loaded as `<script type="module">`, browser resolves dependency tree automatically. Service worker uses `import` for `APP_VERSION`.
- Sheet split: `sheet.js` (orchestrator + shared helpers), `sheet-screen.js` (screen rendering) — isolates screen layout to one file
- Service worker registration in `loader.js` with `{ type: 'module' }` — enables offline caching, cache busting via `APP_VERSION`
- Restart App handler awaits async cleanup (SW unregistration + cache deletion) before reload — fixes race condition
- Help documentation kept current alongside feature delivery — geronimo and kraken workflows include help.html check steps, bazinga establishes doc-as-delivery principle
- `Game` decoupled from `Storage`: mutation methods (`addEvent`, `deleteEvent`, `editEvent`, `advancePeriod`) no longer call `Storage.save()` — UI layer (`events.js`) owns persistence
- Score formatting extracted: `formatFractionalScore()` exported from `game.js` as a pure utility
- Stateless Sheet: `Sheet.game` removed, `Sheet.init()` replaced with `Sheet.render(game)` — all render methods accept `game` as parameter. Imports `Storage` only for inline roster saves.
- Legacy JS pagination engine, data builders, and `sheet-print.js` removed entirely in favor of native CSS printing
- Time parsing extracted: `time.js` exports pure functions (`getMaxMinutes`, `parseTime`, `formatTimeDisplay`) — `events.js` delegates via thin wrappers
- Export module extracted: `export.js` exports pure functions (`buildCSV`, `makeFilename`) — CSV/filename builders with zero DOM dependency
- Input validation fixes: cap `"0"` rejected, time `"0:60"` rejected (seconds ≥ 60)
- Dev server: `tools/serve.go` (Go stdlib) with correct MIME types for ES modules
- Test data: realistic game fixtures in `testdata/` (small/medium/large) for NCAA and NFHS rule sets
- Home/Away team designation: config-driven `homeTeam` per rule set (USAWP=White, NFHS/NCAA=Dark via `_academic`), flip button override on setup, all display surfaces (score bar, sheet, CSV) render Home first/Away second
- `DEFAULTS` object in `config.js`: centralized fallback defaults for all rule-set properties, used by safe mode and normalization — zero scattered magic numbers
- `DEFAULTS` imported as `{ RULES, DEFAULTS }` in game.js, setup.js, storage.js for consistent fallback handling

### Known Gaps / Future Work 📋
- No substitution tracking (user hasn't decided)
- Refactor tests to contract-based assertions (#151)

---

## How to Run

Serve locally with any static file server. The app has no build step.
Do NOT use Python's `http.server` — use the included dev server in the branch:

```sh
go run tools/serve.go
```

Then open `http://localhost:8080`.

---
