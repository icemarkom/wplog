# wplog — Agent Handoff & Continuation Guide

## Project Summary

**wplog** is a water polo secondary game log — a client-side-only PWA (Progressive Web App) built with **Vanilla HTML/CSS/JS** (no npm, no build tools). It lets a coach or volunteer log game events poolside and produce an official-looking game sheet.

- **Repo**: `github.com/icemarkom/wplog`
- **Live**: `https://icemarkom.github.io/wplog/`
- **License**: Apache 2.0, copyright Marko Milivojevic
- **Tech**: Pure HTML/CSS/JS, no framework, no build step. No vendored libs.

---

## Architecture

```
wplog/
├── index.html          # Single-page app shell (4 screens as <section>)
├── css/
│   ├── style.css       # Dark-mode design system, mobile-first
│   └── print.css       # Print-only B&W styles for game sheet
├── js/
│   ├── config.js       # RULES definitions (USAWP, NFHS Varsity, NFHS JV)
│   ├── storage.js      # localStorage wrapper
│   ├── game.js         # Core data model + game logic
│   ├── setup.js        # Setup screen (with active-game guards)
│   ├── events.js       # Live log screen (main UI)
│   ├── sheet.js        # Game sheet rendering (2-page print layout)
│   ├── share.js        # Share/Print functionality
│   └── app.js          # App init + screen navigation
├── sw.js               # Service worker (offline caching, v2)
├── manifest.json       # PWA manifest (relative paths for GH Pages)
├── .github/
│   └── workflows/
│       └── deploy.yml  # Release-triggered deploy to gh-pages
├── .agents/
│   └── workflows/
│       └── geronimo.md # "geronimo" = one-time approval to commit/push/close
└── lib/                # Empty (previously had vendored libs, now removed)
```

Script load order matters: `config.js` → `storage.js` → `game.js` → `setup.js` → `events.js` → `sheet.js` → `share.js` → `app.js`

---

## Hosting & Deployment

- **GitHub Pages** serves from `gh-pages` branch (not `main`)
- **Development** happens on `main` — pushes do NOT affect the live site
- **Releases** trigger the deploy Action: `gh release create v1.x.x --title "..." --notes "..."`
- Deploy Action uses `peaceiris/actions-gh-pages@v4` to copy files to `gh-pages`

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
| **"Geronimo" workflow** | When user says "geronimo", it's one-time approval to commit, push, and close the relevant issue. See `.agents/workflows/geronimo.md`. |
| **Auto-clear on refocus** | Tapping a filled time/cap field in the modal auto-clears it for re-entry. Only on user clicks, not auto-advance. |

### USAWP Events

| Name | Code | Flags |
|---|---|---|
| Goal | `G` | — |
| Exclusion | `E` | `isPersonalFoul: true` |
| Penalty | `P` | `isPersonalFoul: true` |
| Timeout | `TO` | `noPlayer: true` |
| Timeout 30 | `TO30` | `noPlayer: true` |
| Yellow Card | `YC` | — |
| Penalty-Exclusion | `P-E` | `isPersonalFoul: true` |
| Misconduct | `MC` | `autoFoulOut: 1` |
| Brutality | `BR` | `autoFoulOut: 1` |
| Red Card | `RC` | — |
| Game Exclusion | `E-Game` | `autoFoulOut: 1` |

### NFHS Events (Varsity & JV)

Same as USAWP plus:

| Name | Code | Flags |
|---|---|---|
| Minor Act | `MAM` | `isPersonalFoul: true, autoFoulOut: 2` |
| Flagrant Misconduct | `FM` | `autoFoulOut: 1` |

NFHS does not have Brutality.

---

## Current State (as of 2026-03-13)

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

### Known Gaps / Future Work 📋
- No NCAA rules yet (structure ready)
- No sprint tracking (user hasn't decided)
- No substitution tracking (user hasn't decided)
- Multi-game management not implemented (save/load multiple games)
- No favicon (minor 404 in console)
- Service worker hasn't been tested offline
- `lib/` directory is empty and could be removed
- Issue #13 open: Add Additional Rule Sets (NFHS partially done, NCAA pending)
- Issue #12 open: Shootout Scores are Fractional
- Issue #10 open: About Tab or Version
- Issue #3 open: Basic User Guide / Help

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
7. **Release to publish** — development happens on `main`. Use `gh release create` to deploy to GitHub Pages.
8. **Previous conversations** exist about a full water polo scoreboard/timer controller (WTTC-1) — this is a separate, simpler project.
9. **Game clock is M:SS** — max time is capped by period length (not hardcoded 9:59). Right-to-left digit entry. Start/end times remain HH:MM.
10. **Modal uses responsive breakpoints** — default is full-screen (mobile), `@media (min-width: 900px) and (min-height: 700px)` switches to desktop dialog.
11. **Personal fouls are config-driven** — use `isPersonalFoul: true` on events. Don't hardcode event codes for foul counting.
12. **MAM is a dual-trigger event** — `isPersonalFoul: true` + `autoFoulOut: 2`. This pattern was explicitly designed for NFHS/NCAA.
