---
name: branching
description: >-
  Determines the correct Git branch to create and manages the branching lifecycle
  for this project. Use when starting work on an issue, creating a branch, switching
  branches, or preparing a release. Also use when the geronimo or kraken workflows
  need to know the base branch for a PR or merge target.
---

# Branching

## Current state

- **`main`** — stable, production-ready v2.x line (all v2.x releases deploy from here)
- **`v3`** — long-lived integration branch for v3.0.0 features (branches from `main`, merges back when ready)
- **Live site** deploys from `gh-pages` via release tags on `main`

## Branch types

### v2.x work (on `main`)

Bug fixes and minor enhancements for the current production release:

| Work type | Branch pattern | Base branch | Merge target |
|---|---|---|---|
| Bug fix | `fix/<name>` | `main` | `main` |
| Minor enhancement | `feature/<name>` | `main` | `main` |

### v3 work (on `v3`)

New features targeting the v3.0.0 release:

| Work type | Branch pattern | Base branch | Merge target |
|---|---|---|---|
| v3 feature | `feature/<name>` | `v3` | `v3` |
| v3 fix | `fix/<name>` | `v3` | `v3` |

Short-lived branch naming examples: `fix/missing-stat`, `feature/edit-in-place`, `feature/setup-redesign`.

## Start work

Determine whether the work targets **v2.x** (main) or **v3** (v3):

```sh
# v2.x work
git checkout main
git pull origin main
git checkout -b fix/<name>    # or feature/<name>

# v3 work
git checkout v3
git pull origin v3
git checkout -b feature/<name>    # or fix/<name>
```

When done, use the **geronimo** workflow to commit, push, PR into the correct target branch (`main` or `v3`), merge, and delete the branch.

## Syncing v2.x hotfixes into v3

When a hotfix lands on `main` that v3 also needs:

```sh
git checkout v3
git merge main -m "Sync main into v3"
```

## Ship a release

- **v2.x**: Use the **kraken** workflow to tag and release from `main`.
- **v3.0.0**: When v3 is complete, merge `v3` into `main`, then use **kraken** to tag and release.

## Gotchas

- **Never commit directly to `main`** — always use short-lived branches and PRs
- **Geronimo on `main`** is an escape hatch (commit + push only, no PR) — not the norm
- **`v3` is long-lived** — don't delete it until v3.0.0 ships
- **Ask which train** — when starting work, confirm whether it targets v2.x or v3

## Validation

Before starting work, verify your branch state:

```sh
git branch --show-current           # confirm you're on the right branch
git log --oneline -3                # confirm you branched from the correct base
```
