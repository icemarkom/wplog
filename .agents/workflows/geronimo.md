---
description: Commit, push, and close issue — triggered by user saying "geronimo"
---

# Geronimo — Ship It Workflow

When the user says **"geronimo"**, they are giving one-time approval to run all three (or any required) steps below. This approval covers ONLY the current set of changes — it does NOT carry over to future work.

// turbo-all

1. **Fix license headers** — run `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .` to add any missing headers.
2. **Commit** the staged/changed files with an appropriate commit message referencing the issue number.
3. **Push** to `origin main`.
4. **Comment on and close** the relevant GitHub issue using `gh issue close <N> -c "<comment>"`.

> **Important:** Outside of the "geronimo" trigger, NEVER commit, push, or close issues without explicit user confirmation.