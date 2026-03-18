---
description: Commit, push, and close issue — triggered by user saying "geronimo"
---

# Geronimo — Ship It Workflow

When the user says **"geronimo"**, they are giving one-time approval to run all steps below. This approval covers ONLY the current set of changes — it does NOT carry over to future work.

> **Branch-aware:** The `branching` skill (`.agents/skills/branching/SKILL.md`) documents branch creation and strategy. Geronimo handles branch *shipping* — the table below maps branch type to merge behavior.

| Branch pattern | Geronimo does |
|---|---|
| `v2/<name>` | commit, push, PR into `v2-dev`, merge, delete branch |
| `fix/<name>` | commit, push, PR into `main`, merge, delete branch |
| `v2-dev` | commit + push only (no PR/merge — escape hatch) |

// turbo-all

1. **Fix license headers** — run `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .` to add any missing headers.
2. **Commit** the staged/changed files with an appropriate commit message referencing the issue number.
3. **Push** the current branch to `origin`.
4. **Merge via GitHub** (skip on `v2-dev`) — create a PR and merge into the appropriate base branch:
   - `fix/<name>` branches → PR into `main`
   - `v2/<name>` branches → PR into `v2-dev`
   ```sh
   gh pr create --fill --base <base-branch>
   gh pr merge --merge --delete-branch
   ```
5. **Pull base branch** locally (skip on `v2-dev`):
   - `fix/<name>` → `git checkout main && git pull origin main`
   - `v2/<name>` → `git checkout v2-dev && git pull origin v2-dev`
6. **Comment on and close** the relevant GitHub issue using `gh issue close <N> -c "<comment>"`. Skip if the issue is still in progress.

> **Important:** Outside of the "geronimo" trigger, NEVER commit, push, or close issues without explicit user confirmation.

> **Note:** Development happens on branches, never directly on `main`. All merges to `main` go through GitHub.