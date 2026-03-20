---
description: Bootstrap a new conversation — triggered by user saying "bazinga"
---

# Bazinga — New Conversation Bootstrap Workflow

When the user says **"bazinga"**, they want you to bootstrap your context for a new conversation. This means reading all relevant project information before doing any work.

// turbo-all

1. **Read `AGENTS.md`** — review the project summary, architecture, design decisions, current state, and agent notes at the top of the repo.
2. **Read the codebase** — open and familiarize yourself with every source file listed in the Architecture section (`index.html`, `css/`, `js/`, `sw.js`, `manifest.json`). Understand the script load order and how screens are structured.
3. **Prune stale branches** — run `git fetch --prune origin` to clean up any stale remote tracking references from previously merged branches.
4. **Fetch open GitHub issues** — run `gh issue list --state open` to see all currently open issues. Read each issue's details with `gh issue view <N>` to understand scope and context.
5. **Install license header pre-commit hook** — run:
   ```sh
   cat > .git/hooks/pre-commit << 'EOF'
   #!/bin/sh
   addlicense -check -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .
   EOF
   chmod +x .git/hooks/pre-commit
   ```
6. **Start dev server** — run `go run tools/serve.go &` in the background. Do NOT use Python's `http.server` — it doesn't serve ES modules correctly.
7. **Report readiness** — summarize what you've learned (project state, open issues, any observations) and let the user know you're ready to work.

> **Important:** Do NOT start making any code changes until the user gives a specific task after you report readiness.

## Plan-First Workflow

All new work — including work started in a bazinga-bootstrapped thread — **must** follow this pattern:

1. User requests a feature or change.
2. **Create a branch** for the work before making any changes. Never commit directly to `main`.
3. You create an **implementation plan** (artifact) describing the proposed approach.
4. You and the user **iterate and discuss** the plan until the user approves it.
5. Only **after approval**, you proceed with implementation on the branch.

> **CAUTION:** Never skip the planning and discussion phase for anything beyond the simplest, most obvious tasks (e.g., a trivial typo fix). When in doubt, plan first.

> **IMPORTANT:** User-facing documentation (`help.html`) is an integral part of feature delivery. Implementation plans for user-facing changes must include help content updates.

## Security Checklist

When making changes that render user-supplied data (team names, cap numbers, Game #, location, etc.) into the DOM via `innerHTML`:

- **Always use `escapeHTML()`** from `js/sanitize.js` to wrap user-controlled values before interpolation
- **Never bypass** this requirement — even if the data "looks safe" (e.g., cap numbers)
- Refer to `AGENTS.md` design decision on **innerHTML sanitization** for full details
