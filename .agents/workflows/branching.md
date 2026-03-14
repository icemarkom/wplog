---
description: Branching strategy for parallel v1 fixes and v2 feature development
---

# Branching Strategy

## Current State

- **`main`** = stable, production-ready (v1.x releases deploy from here)
- **`feature/stats-v2`** = long-lived v2 feature branch (stats + future v2 work)
- **Live site** deploys from `gh-pages` via release tags on `main`

## v2 Feature Work

All v2 development happens on `feature/stats-v2`:

```sh
git checkout feature/stats-v2
# ... make changes ...
# geronimo -> commit + push (stays on branch, no merge to main)
```

Do NOT merge `feature/stats-v2` to `main` until v2 is ready to ship.

## v1 Hotfixes (while v2 is in progress)

If a fix is needed on the live site while v2 is still in development:

```sh
git stash                          # save any WIP on current branch
git checkout main
git checkout -b fix/description    # branch off main
# ... make the fix ...
# geronimo -> commit, push, PR, merge to main
# kraken -> tag v1.x.x (deploys to production)
git checkout feature/stats-v2
git rebase main                    # pick up the fix into v2 branch
git stash pop                      # restore WIP if needed
```

## Shipping v2

When v2 is complete and tested:

```sh
git checkout feature/stats-v2
# final commit if needed
# geronimo -> commit, push, PR, merge to main
# kraken -> tag v2.0.0 (deploys to production)
```

## Rules

1. **Never commit directly to `main`** - always use branches
2. **Always rebase v2 onto main** after any v1 fix lands
3. **geronimo** on v2 branch = commit + push only (no PR/merge to main)
4. **geronimo** on fix branches = full workflow (commit, push, PR, merge)
5. **kraken** only runs from `main` after merging
