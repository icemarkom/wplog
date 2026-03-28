---
description: Tag and release a new version — triggered by user saying "kraken"
---

# Kraken — Release the Kraken Workflow

When the user says **"kraken"**, they want to prepare and publish a new release. This workflow walks through evaluating changes, updating docs, proposing a version, and creating the GitHub release.

## Steps

- **Fetch all tags** — run `git fetch --tags origin` to ensure local tags are up to date with the remote. Without this, `git describe` may report a stale version.

- **Evaluate changes since last release** — run `git log $(git describe --tags --abbrev=0)..HEAD --oneline` to see all commits since the last tag. Summarize the changes by category (features, fixes, improvements).

- **Determine version bump** — based on the changes, propose a version number following semver:
   - **Patch** (x.x.+1): bug fixes, minor tweaks, styling changes
   - **Minor** (x.+1.0): new features, new event types, new screens
   - **Major** (+1.0.0): breaking changes, data model changes (unlikely for this project)
   Present the proposed version to the user with justification.

- **Update `AGENTS.md` and `help.html`** — review and update the "Current State" section:
   - Move newly completed items to the "What's Done ✅" list
   - Remove completed items from "Known Gaps / Future Work 📋"
   - Update the date in the section header
   - Add any new design decisions to the table if applicable
   - If any user-facing features were added since the last release, update `help.html`

- **Prepare release notes** — create an implementation plan artifact with:
   - Proposed version number (e.g., `v1.4.0`)
   - Release title
   - Categorized changelog
   - Any breaking changes or migration notes

   > **Release notes must be user-facing and user-centric.** Only changes that affect end users belong under "Features" or "Fixes." Code refactoring, CSS consolidation, internal architecture changes, dependency updates, license headers, workflow changes, etc., go under "Internal" (with subsections if needed). When evaluating the version bump, only count user-visible changes — internal-only changes are patch-level regardless of scope.

- **Request review** — present the release notes and `AGENTS.md` changes to the user via `notify_user`. Iterate on feedback until the user approves.

- **Tag and release** — once approved:

// turbo-all

   - **Run tests** — execute `./tools/test.sh`. This must pass before proceeding.
   - Fix license headers: `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .`
   - Commit the `AGENTS.md` update on the current branch: `git add AGENTS.md && git commit -m "docs: update AGENTS.md for vX.Y.Z release"`
   - Push and merge to main via GitHub:
      ```sh
      git push origin HEAD
      gh pr create --fill --base main
      gh pr merge --merge --delete-branch
      ```
   - Pull main locally: `git pull origin main`
   - Create the annotated tag: `git tag -a vX.Y.Z -m "<release notes>"`
   - Push the tag: `git push origin vX.Y.Z`
   - Create the GitHub release: `gh release create vX.Y.Z --title "vX.Y.Z — <title>" --notes "<release notes>"`
   - Prune stale branches: `git fetch --prune origin`

> **Important:** Steps 7a–7i are only executed AFTER the user explicitly approves the release notes. The `// turbo-all` annotation applies only to step 7 sub-steps. Steps 1–6 require normal interaction and review.

> **Note:** The deploy workflow (`.github/workflows/deploy.yml`) will automatically trigger on release publish, injecting the version tag into `config.js` and deploying to GitHub Pages.

> **Note:** Development happens on branches, never directly on `main`. All merges to `main` go through GitHub. See the `branching` skill (`.agents/skills/branching/SKILL.md`) for how to get changes merged to `main`.
