---
description: Commit, push, and close issue — triggered by user saying "geronimo"
---

# Geronimo — Ship It Workflow

When the user says **"geronimo"**, they are giving one-time approval to run all steps below. This approval covers ONLY the current set of changes — it does NOT carry over to future work.

> **Branch-aware:** The `branching` skill (`.agents/skills/branching/SKILL.md`) documents branch creation and strategy. Geronimo handles branch *shipping* — the table below maps branch type to merge behavior.

| Branch pattern | Geronimo does |
|---|---|
| `fix/<name>` | commit, push, PR into `main`, merge, delete branch |
| `feature/<name>` | commit, push, PR into `main`, merge, delete branch |
| `main` | commit + push only (no PR/merge — escape hatch) |

// turbo-all

1. **Fix license headers** — run `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .` to add any missing headers.
2. **Commit** the staged/changed files with an appropriate commit message referencing the issue number.
   > **Signed commits:** All commits in this repo are signed. The commit command will trigger a passphrase prompt. When this happens, **pause and instruct the user to enter the passphrase in the IDE** — it is handled by an extension the agent cannot interact with. Wait for the commit to complete before proceeding.
3. **Push** the current branch to `origin`.
4. **Merge via GitHub** (skip on `main`) — create a PR and merge into `main`:
   ```sh
   gh pr create --fill --base main
   gh pr merge --merge --delete-branch
   ```
5. **Pull main** locally (skip if already on `main`):
   ```sh
   git checkout main && git pull origin main
   ```
6. **Comment on and close** the relevant GitHub issue using `gh issue close <N> -c "<comment>"`. Skip if the issue is still in progress.
7. **Prune stale branches** — run `git fetch --prune origin` to clean up any stale remote tracking references.

> **Important:** Outside of the "geronimo" trigger, NEVER commit, push, or close issues without explicit user confirmation.

> **Note:** Development happens on branches, never directly on `main`. All merges to `main` go through GitHub.