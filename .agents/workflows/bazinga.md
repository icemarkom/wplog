---
description: Bootstrap a new conversation — triggered by user saying "bazinga"
---

# Bazinga — New Conversation Bootstrap Workflow

When the user says **"bazinga"**, they want you to bootstrap your context for a new conversation. This means reading all relevant project information before doing any work.

// turbo-all

- **Read `AGENTS.md`** and review previous convesations if needed.
- **Read the codebase** — as needed read other documentation and code.
- Ad-hoc or other Python scripts are off-limits. If a web server is needed, use serve.go.
- You are never to install tools. If you need a tool, stop and ask the user for direction.
- You are not allowed to write any files outside the workspace, including /tmp.

## Planning First
All work — including new and iterative work  — **must** follow this pattern:

- User requests a feature or change.
- **Create a branch** for the work before making any changes. Never commit directly to `main`.
- You create an **implementation plan** (artifact) describing the proposed approach.
- You and the user **iterate and discuss** the plan until the user explicitly approves it.
- Only **after approval**, you proceed with implementation on the branch.

> **CAUTION:** Never skip the planning and discussion phase for anything beyond the simplest, most obvious tasks (e.g., a trivial typo fix). Plan first.

> **IMPORTANT:** User-facing documentation (`help.html`) is an integral part of feature delivery. Implementation plans for user-facing changes must include help content updates.

## Security Checklist

When making changes that render user-supplied data (team names, cap numbers, Game #, location, etc.) into the DOM via `innerHTML`:

- **Always use `escapeHTML()`** from `js/sanitize.js` to wrap user-controlled values before interpolation
- **Never bypass** this requirement — even if the data "looks safe" (e.g., cap numbers)
- Refer to `AGENTS.md` design decision on **innerHTML sanitization** for full details