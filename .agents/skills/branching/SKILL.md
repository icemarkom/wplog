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

- **`main`** — stable, production-ready v3.x line (all v3.x releases deploy from here)
- **`v4`** — long-lived integration branch for v4.0.0 features (branches from `main`, merges back when ready)
- **Live site** deploys from `gh-pages` via release tags on `main`

## Branch types

### v3.x work (on `main`)

Bug fixes and minor enhancements for the current production release:

| Work type | Branch pattern | Base branch | Merge target |
|---|---|---|---|
| Bug fix | `fix/<name>` | `main` | `main` |
| Minor enhancement | `feature/<name>` | `main` | `main` |

### v4 work (on `v4`)

New features targeting the v4.0.0 release:

| Work type | Branch pattern | Base branch | Merge target |
|---|---|---|---|
| v4 feature | `feature/<name>` | `v4` | `v4` |
| v4 fix | `fix/<name>` | `v4` | `v4` |

Short-lived branch naming examples: `fix/missing-stat`, `feature/edit-in-place`, `feature/setup-redesign`.

## Start work

Determine whether the work targets **v3.x** (main) or **v4** (v4):

```sh
# v3.x work
git checkout main
git pull origin main
git checkout -b fix/<name>    # or feature/<name>

# v4 work
git checkout v4
git pull origin v4
git checkout -b feature/<name>    # or fix/<name>
```

When done, use the **geronimo** workflow to commit, push, PR into the correct target branch (`main` or `v4`), merge, and delete the branch.

## Syncing v3.x hotfixes into v4

When a hotfix lands on `main` that v4 also needs:

```sh
git checkout v4
git merge main -m "Sync main into v4"
```

## Ship a release

- **v3.x**: Use the **kraken** workflow to tag and release from `main`.
- **v4.0.0**: When v4 is complete, merge `v4` into `main`, then use **kraken** to tag and release.

## Gotchas

- **Never commit directly to `main`** — always use short-lived branches and PRs
- **Geronimo on `main`** is an escape hatch (commit + push only, no PR) — not the norm
- **`v4` is long-lived** — don't delete it until v4.0.0 ships
- **Ask which train** — when starting work, confirm whether it targets v3.x or v4

## Validation

Before starting work, verify your branch state:

```sh
git branch --show-current           # confirm you're on the right branch
git log --oneline -3                # confirm you branched from the correct base
```
