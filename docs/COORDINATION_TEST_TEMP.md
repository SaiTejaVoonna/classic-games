# Coordination Test (Temporary)

Marker: `CLASSIC-GAMES-STEP2-20261019`

This is a temporary document for the Step 2 coordination test. It will be removed on Codex's cleanup instruction after independent review.

## Roles
- **Claude Code (implementation agent):** implements only bounded, explicitly approved tasks with acceptance criteria, delivers changes through GitHub branches and PRs, reports results and evidence, then stops for the next instruction. It does not merge, expand scope, or add dependencies, games, websites, or deployments without approval.
- **Codex (technical lead):** planning, historical research, architecture, scoped delegation, review, and QA (gameplay fidelity, responsive behavior, test results).
- **SaiTejaVoonna (product owner):** approves product direction, gameplay changes, visual direction, new features, packages, expenses, and releases.

## Shared rules
Both agents follow `AGENTS.md` as the single source of truth (`CLAUDE.md` points to it). Work proceeds one user-approved step at a time. Messages prefixed `[Codex]` come from Codex; unprefixed messages come from the product owner.
