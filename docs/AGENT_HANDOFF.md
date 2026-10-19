# Agent Handoff

## Roles
- **SaiTejaVoonna** — product owner; approves product direction, gameplay, visuals, and releases.
- **Codex** — technical lead and reviewer; repository setup, research, architecture, scoped delegation, review, validation.
- **Claude Code** — implementation agent for future, explicitly approved, bounded tasks only.

## Current phase
Repository setup only. No website, game, prototype, or deployment exists or is authorized. The earlier no-delegation restriction was lifted solely for this setup handshake and verification task. Work stops after the handshake until the next user-approved step.

## Verification evidence (cloud checkout, before this change)
| Check | Result |
| --- | --- |
| Origin URL | `https://github.com/SaiTejaVoonna/classic-games` (fetch and push) |
| Current branch | `claude/stoic-wozniak-k6o9hd` |
| HEAD SHA | `71b8ff10f0e3e50cab24725874374fb13540fe2e` (same as `origin/main`) |
| Tracked files | `AGENTS.md`, `README.md` |
| `git status --short` | clean (no output) |
| `git fetch origin` | exit 0 (authenticated fetch works) |
| `git ls-remote --heads origin` | `refs/heads/main` at `71b8ff10…` |

## Coordination protocol
- Task instructions reach Claude Code through its session.
- Source changes and review evidence flow through GitHub branches and pull requests.
- No direct access to the Codex chat or machine is assumed.
- No extra network domains or secrets are needed for this handshake.
- Work one user-approved step at a time, report results, and stop. Do not merge PRs or expand scope without instruction.
- Shared project instructions are in `AGENTS.md`; `CLAUDE.md` points to it.
