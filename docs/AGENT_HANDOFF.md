# Agent Handoff

## Roles
- **SaiTejaVoonna** — product owner; approves product direction, gameplay, visuals, and releases.
- **Codex** — technical lead and reviewer; repository setup, research, architecture, scoped delegation, review, validation.
- **Claude Code** — implementation agent for scoped, explicitly approved tasks only.

The full coordination workflow and permanent rules are in [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

## Current state: Step 2 (coordination only)
- Step 2 is limited to establishing and verifying the Codex/Claude coordination workflow. No game, website, dependencies, or deployment exist or are authorized.
- The temporary `docs/COORDINATION_TEST_TEMP.md` was added at `55ac6dffe24be8640770d10d95e4860436d6fea2` and independently reviewed by Codex. Cleanup was pending until the commit that adds this update, which deletes it in a normal commit. Once pushed, it is absent at that commit and later tips but retained in earlier history.
- PR #1 is unmerged, pending approval. Step 2 is complete only after Codex's final independent review.
- `AGENTS.md` is unchanged and still says not to delegate to Claude yet. The owner's latest Step 2 request authorizes this bounded coordination test under its "latest explicit instructions take precedence" clause; no permanent or broader delegation grant is asserted.

## Earlier evidence: setup handshake (before any change, commit `2f758b1`)
Recorded at the time of the first handshake, from the cloud checkout:

| Check | Result |
| --- | --- |
| Origin URL | `https://github.com/SaiTejaVoonna/classic-games` (fetch and push) |
| Branch | `claude/stoic-wozniak-k6o9hd` |
| HEAD SHA | `71b8ff10f0e3e50cab24725874374fb13540fe2e` (same as `origin/main`) |
| Tracked files | `AGENTS.md`, `README.md` |
| `git status --short` | clean |
| `git fetch origin` | exit 0 |
| `git ls-remote --heads origin` | `refs/heads/main` at `71b8ff10…` |

## Coordination protocol
- Task instructions come through this session; `[Codex]`-prefixed messages are from Codex, unprefixed from the product owner.
- Source changes and review evidence go through GitHub branches and PRs.
- No direct access to the Codex chat or machine is assumed.
- No extra network domains or secrets are needed.
- One user-approved step at a time; report and stop. Do not merge or expand scope without instruction.
- Shared project instructions are in `AGENTS.md`; `CLAUDE.md` points to it.

## Latest handoff: research and planning (2026-10-19)
The owner supplied the full GPT-6 project handoff after Step 2. Codex prepared NOKIA_REFERENCE.md, INTERFACE_SPEC.md and ARCHITECTURE_PLAN.md directly and updated AGENTS.md. This supersedes the earlier setup-only phase above; all recorded Step 2 evidence remains historical evidence.
The Nokia 3310 manual verifies core menu functions, but the exact engine constants remain unresolved. Do not build the game from generated image geometry or related-handset rules. Owner review and original-device verification are the next gates.
The coordination PR #1 remains unmerged. Planning is on a separate Codex branch based on its reviewed tip; no Claude delegation, merge or deployment was performed. Both images generated in this Codex chat remain unapproved discussion references and were not sent to Claude.
