---
description: Commit, push, and close issue — triggered by user saying "geronimo"
---

# Geronimo — Ship It Workflow

When the user says **"geronimo"**, they are giving **one-time approval** to run all steps below for **one push**. This approval covers ONLY the current set of changes — it does NOT carry over to future work in the same session.

> **Branch-aware:** The `branching` skill documents branch creation and strategy. Geronimo handles branch *shipping*.

// turbo-all

1. **Update `help.html`** — if any user-facing changes are being shipped, check whether the help content needs updating. Update. If user didn't explicitly mentioned, **STOP:** inform the user.
2. **Update `AGENTS.md`** — review the "Current State" section and update it to reflect the changes being shipped:
   - Add new items to the "What's Done ✅" list
   - Update design decision table entries if any decisions changed
   - Update the date in the section header
   - Remove completed items from "Known Gaps / Future Work 📋" if applicable
3. **Fix license headers** — run `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .` to add any missing headers.
4. **Run tests** — execute `./tools/test.sh`. This must pass before committing.
   > If tests fail, fix the issue and re-run. Do NOT proceed to commit with failing tests.
5. **Commit** the staged/changed files with an appropriate commit message referencing the issue number.
   > **Signed commits:** All commits in this repo are signed. The commit command will trigger a passphrase prompt. When this happens, **pause and instruct the user to enter the passphrase in the IDE** — it is handled by an extension the agent cannot interact with. Wait for the commit to complete before proceeding.
6. **Push** the current branch to `origin`.
7. **Merge via GitHub** (skip on `main`) — create a PR and merge into `main`:
   ```sh
   gh pr create --fill --base main
   gh pr merge --merge --delete-branch
   ```
8. **Pull main** locally (skip if already on `main`):
   ```sh
   git checkout main && git pull origin main
   ```
9. **Comment on and close** the relevant GitHub issue using `gh issue close <N> -c "<comment>"`. Skip if the issue is still in progress.
10. **Prune stale branches** — run `git fetch --prune origin` to clean up any stale remote tracking references.

> **Important:** Outside of the "geronimo" trigger, NEVER commit, push, or close issues without explicit user confirmation.

> **Note:** Development happens on branches, never directly on `main`. All merges to `main` go through GitHub.