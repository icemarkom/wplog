# wplog — Agent Handoff & Continuation Guide

## Project Summary

**wplog** is a water polo secondary game log — a client-side-only PWA (Progressive Web App) built with **Vanilla HTML/CSS/JS** (no npm, no build tools). It lets a coach or volunteer log game events poolside and produce an official-looking game sheet.

- **Repo**: `github.com/icemarkom/wplog`
- **License**: Apache 2.0, copyright Marko Milivojevic
- **Tech**: Pure HTML/CSS/JS, no framework, no build step. Two vendored libs (`pako.min.js` for gzip, `qrcode.min.js` for QR codes)

---

## Architecture

```
wplog/
├── index.html          # Single-page app shell (4 screens as <section>)
├── css/
│   ├── style.css       # Dark-mode design system, mobile-first
│   └── print.css       # Print-only B&W styles for game sheet
├── js/
│   ├── config.js       # RULES definitions (USAWP only for now)
│   ├── storage.js      # localStorage wrapper
│   ├── game.js         # Core data model + game logic
│   ├── setup.js        # Setup screen
│   ├── events.js       # Live log screen (main UI)
│   ├── sheet.js        # Game sheet rendering
│   ├── qr.js           # QR code sharing + compression
│   └── app.js          # App init + screen navigation
├── sw.js               # Service worker (offline caching)
├── manifest.json       # PWA manifest
└── lib/                # Vendored third-party libs
    ├── pako.min.js     # gzip compression
    └── qrcode.min.js   # QR code generation
```

Script load order matters: `config.js` → `storage.js` → `game.js` → `setup.js` → `events.js` → `sheet.js` → `qr.js` → `app.js`

---

## Key Design Decisions

These were explicitly discussed and agreed with the user:

| Decision | Detail |
|---|---|
| **No roster/player entry** | Cap numbers are entered per-event, not pre-game. No player names. |
| **Team names in UI vs reports** | UI always shows "White"/"Dark". Game sheet shows "White (Team Name)" when custom name set. |
| **Cap numbers are strings** | Support goalie modifiers: `"1A"`, `"1B"`, `"1C"` (max C). Input via large numpad. |
| **Time format** | 0-padded: `"07:00"` not `"7:00"`. Clock counts DOWN in water polo. |
| **`rules` not `competition`** | Field is named `rules` in the data model. Config constant is `RULES`. |
| **Period End code** | Uses `"---"` (non-alphanumeric) to avoid collision with real event codes. |
| **Unlimited overtime** | OT periods: `"OT1"`, `"OT2"`, ... `"OTn"`. New tab auto-appears after each Period End. |
| **OT/Shootout per-game** | Rules provide defaults; setup screen has toggles to override per game. |
| **`autoFoulOut` is numeric** | `1` = immediate (MC, E-Game, BR), `2` = after 2nd occurrence (future MAM). Absent = none. |
| **USAWP only for now** | NFHS and NCAA to be added later. Structure supports it. |

### USAWP Events (current)

| Name | Code | Flags |
|---|---|---|
| Goal | `G` | — |
| Exclusion | `E` | — |
| E-Game | `E-Game` | `autoFoulOut: 1` |
| Penalty | `P` | — |
| Penalty-Exclusion | `P-E` | — |
| Timeout | `TO` | `noPlayer: true` |
| Timeout 30 | `TO30` | `noPlayer: true` |
| Yellow Card | `YC` | — |
| Red Card | `RC` | — |
| Misconduct | `MC` | `autoFoulOut: 1` |
| Brutality | `BR` | `autoFoulOut: 1` |

---

## Current State (as of 2026-03-11)

### What's Done ✅
- Complete setup screen (rules, date, time, location, team names, OT/SO toggles)
- Live log with score bar, period tabs, time input, team toggle, cap numpad, all 11 event buttons
- Event logging → score updates → recent events list
- Period End button with auto-advance
- Foul-out detection (accumulated + auto) with popup overlay
- Game sheet rendering (progress of game, period scores, foul summary, timeouts)
- QR code sharing (compress → base64 → QR), clipboard copy, HTML download
- localStorage persistence
- PWA manifest + service worker
- Dark mode, mobile-first CSS, print stylesheet
- Git repo initialized, 4 commits, remote set

### What Needs Testing 🧪
- Period end → transitions (Q1→Q2→...→Q4→OT/SO)
- Foul-out popup (3 exclusions same player, or MC/E-Game/BR)
- OT tabs appearing dynamically
- Shootout mode (time disabled, auto 00:00)
- Game Sheet rendering with real event data
- QR code generation + scanning
- Print layout (Ctrl+P)
- localStorage restore on page reload
- Mobile viewport (375px)

### Known Gaps / Future Work 📋
- No NFHS or NCAA rules yet (structure ready)
- No sprint tracking (user hasn't decided)
- No substitution tracking (user hasn't decided)
- Multi-game management not implemented (save/load multiple games)
- Export format only HTML download; no PDF or CSV
- No favicon (minor 404 in console)
- Service worker hasn't been tested offline
- User will want to review and adjust event codes/names

---

## How to Run

Serve locally with any static file server. The app has no build step.

```sh
# Go (available on user's Windows machine):
# Create a small Go file or use:
go run serve.go    # if a serve.go exists

# Or any other static server:
python -m http.server 8080
npx serve
```

Then open `http://localhost:8080`.

---

## Push to GitHub

The repo is clean and ready:

```sh
cd c:\Users\marko\Desktop\src\wps\wplog
git push -u origin main
```

> The user needs to create the empty repo at `github.com/icemarkom/wplog` first (no README, no LICENSE — those are already in the repo).

---

## Notes for Next Agent

1. **The user knows water polo deeply** — they're a coach/referee. Trust their domain knowledge on events, rules, and terminology.
2. **Keep it simple** — the user deliberately chose "no framework, no build tools." Honor that.
3. **Event codes** — the user specifically chose codes like `"E-Game"` (not abbreviated). Don't change them without asking.
4. **The user is iterative** — expect inline comments on artifacts with specific feedback. Incorporate exactly what they say.
5. **Previous conversations** exist about a full water polo scoreboard/timer controller (WTTC-1) at `c:\Users\marko\Desktop\src\wps` — this is a separate, simpler project.
