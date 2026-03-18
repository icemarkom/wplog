---
name: branching
description: >-
  Determines the correct Git branch to create and manages the branching lifecycle
  for this project. Use when starting work on an issue, creating a branch, switching
  branches, rebasing after a fix, or preparing to ship v2. Also use when the geronimo
  or kraken workflows need to know the base branch for a PR or merge target.
---

# Branching

## Current state

- **`main`** — stable, production-ready (v1.x releases deploy from here)
- **`v2-dev`** — long-lived v2 integration branch (stats + future v2 work)
- **Live site** deploys from `gh-pages` via release tags on `main`

## Determine your branch type

Before creating a branch, determine the type of work:

| Work type | Issue label | Branch pattern | Base branch |
|---|---|---|---|
| v2 feature | `v2` | `v2/<name>` | `v2-dev` |
| v1 hotfix | — | `fix/<name>` | `main` |

If the issue has a `v2` label or is in the v2.0.0 milestone, it's v2 work. Otherwise it's a v1 fix.

## Start v2 feature work

```sh
git checkout v2-dev
git pull origin v2-dev
git checkout -b v2/<feature-name>
```

Short-lived branch naming examples: `v2/edit-in-place`, `v2/setup-redesign`, `v2/help-stats`.

When done, use the **geronimo** workflow to commit, push, PR into `v2-dev`, merge, and delete the branch.

## Start a v1 hotfix

```sh
git stash                          # save any WIP on current branch
git checkout main
git pull origin main
git checkout -b fix/<description>
```

When done, use the **geronimo** workflow to commit, push, PR into `main`, merge, and delete the branch. Then use **kraken** to tag and release if deploying.

## Rebase v2-dev after a v1 fix lands

After any fix merges to `main`, `v2-dev` must pick it up:

```sh
git checkout v2-dev
git pull origin v2-dev
git rebase main
git push --force-with-lease
```

Then restore any WIP: `git stash pop`.

## Ship v2

When v2 is complete and tested:

```sh
git checkout v2-dev
# final commit if needed
# geronimo → commit, push, PR into main, merge
# kraken → tag v2.0.0 (deploys to production)
```

## Gotchas

- **Never commit directly to `main`** — always use `fix/<name>` branches and PRs
- **Never commit directly to `v2-dev`** — use `v2/<name>` branches (geronimo on `v2-dev` itself is an escape hatch, not the norm)
- **Never merge `v2-dev` to `main` prematurely** — only when v2 is fully ready to ship
- **Always rebase `v2-dev` onto `main`** after any v1 fix lands — do not skip this
- **Geronimo on `v2-dev`** does commit + push only (no PR/merge) — this is intentional

## Validation

Before starting work, verify your branch state:

```sh
git branch --show-current           # confirm you're on the right branch
git log --oneline -3                # confirm you branched from the right base
```

Expected patterns:
- `v2/<name>` → latest commit should match `v2-dev` history
- `fix/<name>` → latest commit should match `main` history
