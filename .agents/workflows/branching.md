---
description: Branching strategy for parallel v1 fixes and v2 feature development
---

# Branching Strategy

## Current State

- **`main`** = stable, production-ready (v1.x releases deploy from here)
- **`v2-dev`** = long-lived v2 integration branch (stats + future v2 work)
- **Live site** deploys from `gh-pages` via release tags on `main`

## v2 Feature Work

All v2 development uses **short-lived branches off `v2-dev`**:

```sh
git checkout v2-dev
git checkout -b v2/feature-name       # branch off v2-dev
# ... make changes ...
# geronimo -> commit, push, PR into v2-dev, merge, delete branch
```

Short-lived branch naming: `v2/<description>` (e.g., `v2/edit-in-place`, `v2/help-stats`, `v2/setup-redesign`).

Do NOT merge `v2-dev` to `main` until v2 is ready to ship.

## v1 Hotfixes (while v2 is in progress)

If a fix is needed on the live site while v2 is still in development:

```sh
git stash                          # save any WIP on current branch
git checkout main
git checkout -b fix/description    # branch off main
# ... make the fix ...
# geronimo -> commit, push, PR, merge to main
# kraken -> tag v1.x.x (deploys to production)
git checkout v2-dev
git rebase main                    # pick up the fix into v2 branch
git push --force-with-lease        # update remote v2-dev
git stash pop                      # restore WIP if needed
```

## Shipping v2

When v2 is complete and tested:

```sh
git checkout v2-dev
# final commit if needed
# geronimo -> commit, push, PR, merge to main
# kraken -> tag v2.0.0 (deploys to production)
```

## Geronimo Behavior by Branch Type

| Branch | Geronimo does |
|---|---|
| `v2/<name>` | commit, push, PR into `v2-dev`, merge, delete branch |
| `fix/<name>` | commit, push, PR into `main`, merge, delete branch |
| `v2-dev` | commit + push only (no PR/merge — escape hatch) |

## Rules

1. **Never commit directly to `main`** — always use branches
2. **Never commit directly to `v2-dev`** — use `v2/<name>` branches
3. **Always rebase `v2-dev` onto `main`** after any v1 fix lands
4. **geronimo** on `v2/<name>` branches = full workflow (commit, push, PR into `v2-dev`, merge)
5. **geronimo** on `fix/<name>` branches = full workflow (commit, push, PR into `main`, merge)
6. **geronimo** on `v2-dev` = commit + push only (escape hatch, not the norm)
7. **kraken** only runs from `main` after merging
