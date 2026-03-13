---
description: Tag and release a new version — triggered by user saying "kraken"
---

# Kraken — Release the Kraken Workflow

When the user says **"kraken"**, they want to prepare and publish a new release. This workflow walks through evaluating changes, updating docs, proposing a version, and creating the GitHub release.

## Steps

1. **Evaluate changes since last release** — run `git log $(git describe --tags --abbrev=0)..HEAD --oneline` to see all commits since the last tag. Summarize the changes by category (features, fixes, improvements).

2. **Determine version bump** — based on the changes, propose a version number following semver:
   - **Patch** (x.x.+1): bug fixes, minor tweaks, styling changes
   - **Minor** (x.+1.0): new features, new event types, new screens
   - **Major** (+1.0.0): breaking changes, data model changes (unlikely for this project)
   Present the proposed version to the user with justification.

3. **Update `AGENTS.md`** — review and update the "Current State" section:
   - Move newly completed items to the "What's Done ✅" list
   - Remove completed items from "Known Gaps / Future Work 📋"
   - Update the date in the section header
   - Add any new design decisions to the table if applicable

4. **Prepare release notes** — create an implementation plan artifact with:
   - Proposed version number (e.g., `v1.4.0`)
   - Release title
   - Categorized changelog (Features, Fixes, Improvements)
   - List of files changed
   - Any breaking changes or migration notes

5. **Request review** — present the release notes and `AGENTS.md` changes to the user via `notify_user`. Iterate on feedback until the user approves.

6. **Tag and release** — once approved:

// turbo-all

   a. Fix license headers: `addlicense -c "Marko Milivojevic" -l apache -ignore '.github/**' -ignore '.agents/**' -ignore 'lib/**' .`
   b. Commit the `AGENTS.md` update: `git add AGENTS.md && git commit -m "docs: update AGENTS.md for vX.Y.Z release"`
   c. Push: `git push origin main`
   d. Create the annotated tag: `git tag -a vX.Y.Z -m "<release notes>"`
   e. Push the tag: `git push origin vX.Y.Z`
   f. Create the GitHub release: `gh release create vX.Y.Z --title "vX.Y.Z — <title>" --notes "<release notes>"`

> **Important:** Steps 6a–6e are only executed AFTER the user explicitly approves the release notes. The `// turbo-all` annotation applies only to step 6 sub-steps. Steps 1–5 require normal interaction and review.

> **Note:** The deploy workflow (`.github/workflows/deploy.yml`) will automatically trigger on release publish, injecting the version tag into `config.js` and deploying to GitHub Pages.
