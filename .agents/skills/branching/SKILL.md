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

- **`main`** — stable, production-ready (all releases deploy from here)
- **Live site** deploys from `gh-pages` via release tags on `main`

## Branch types

All work uses short-lived branches off `main`:

| Work type | Branch pattern | Base branch | Merge target |
|---|---|---|---|
| Bug fix | `fix/<name>` | `main` | `main` |
| Feature / enhancement | `feature/<name>` | `main` | `main` |

Short-lived branch naming examples: `fix/missing-stat`, `feature/edit-in-place`, `feature/setup-redesign`.

## Start work

```sh
git checkout main
git pull origin main
git checkout -b fix/<name>    # or feature/<name>
```

When done, use the **geronimo** workflow to commit, push, PR into `main`, merge, and delete the branch.

## Ship a release

Use the **kraken** workflow to tag and release from `main`.

## Gotchas

- **Never commit directly to `main`** — always use short-lived branches and PRs
- **Geronimo on `main`** is an escape hatch (commit + push only, no PR) — not the norm

## Validation

Before starting work, verify your branch state:

```sh
git branch --show-current           # confirm you're on the right branch
git log --oneline -3                # confirm you branched from main
```
