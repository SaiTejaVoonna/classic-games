# Classic Games — Project Instructions

## Ownership and workflow
- SaiTejaVoonna is the product owner and approves product direction, gameplay changes, visual direction, and releases.
- Codex is the technical lead responsible for repository setup, historical research, architecture, preparation, scoped delegation, review, and validation.
- Claude Code implements explicitly authorized, scoped tasks; Codex reviews actual files and tests independently. The cloud browser/GitHub workflow passed the Step 2 coordination test. Local CLI orchestration and a local authenticated clone remain unavailable. See docs/AGENT_WORKFLOW.md.
- The separate ChatGPT/GPT-6 planning conversation advises on product requirements and independently reviews reports relayed by the owner. The product owner makes final decisions.
- Work one user-approved step at a time. Complete the requested step, report results, and stop for the next instruction. Do not expand scope automatically.

## Current phase: research and planning only
- The owner-provided project handoff authorizes historical research, interface specification, architecture and documentation. Codex handles this preparation directly; no game implementation or deployment is authorized.
- Read docs/NOKIA_REFERENCE.md, docs/INTERFACE_SPEC.md and docs/ARCHITECTURE_PLAN.md; distinguish proposals, historical facts and unknowns. Stop for owner approval after reporting findings.
- Reuse existing agent conversations, use concise scoped tasks, maintain a single writer per file/branch, and require explicit handoff before switching writers. Never claim completion solely from another agent's report.
- Do not build the website, Snake game, prototypes, or deployment until the user requests the next phase.
- Keep the repository private unless the user explicitly requests a visibility change.

## Product direction from the planning handoff
- Product name: Classic Games. Begin with Snake when implementation is authorized; other games are later, separately scoped work.
- Preserve the original Nokia 3310 Snake II experience in gameplay; modernize the visuals and interface.
- Research and verify historical mechanics before implementing them. Do not guess grid dimensions, speed levels, timing, turning, boundaries, collision, mazes, food/bonus behavior, scoring, or pause/resume rules. Record sources and unresolved questions; avoid mixing handset variants.
- Preserve the familiar menu functions: New game, Continue, Level, Top score, Instructions, and Settings. Verify maze availability and exact menus against the selected reference version before committing to behavior.
- Favor a minimal, responsive interface, one playable board, compact menus, restrained colors, and modern typography and geometry. Avoid a fake phone shell, app-store-style catalogue, or unnecessary decoration.
- Existing concept images are references, not approved designs. Show desktop and mobile designs to the user for approval before implementation.
- Use independent code, artwork, and audio. Nokia may be referenced as historical inspiration with clear unofficial, non-affiliated wording; do not use official logos, original game files, or copied recordings.

## Handoff product requirements
- Preferred stack: HTML, CSS, vanilla JavaScript ES modules and Canvas 2D; native browser APIs and localStorage, with GitHub Pages as a future host subject to deployment approval. No backend, database, paid API or heavyweight framework.
- Provide Colour, LCD and Night presentation themes, keyboard and touch controls, optional independently synthesized sounds and feature-detected haptics. Themes must not change gameplay.
- Aim for roughly 20–35 KB compressed initial transfer if practical; measure actual totals. No guarantee is implied.
- Current concept images are discussion-only and do not establish board dimensions, controls or historical mechanics.

## Future implementation and review
- Obtain user approval before full implementation or deployment, new features, packages, expenses, or changes to approved gameplay or visual direction.
- Once authorized, give implementation agents bounded tasks with acceptance criteria. Codex reviews changes, verifies gameplay fidelity and responsive behavior, and reports deviations and test results.
- Keep project decisions and handoff context in version control as the project develops. Add product specifications and handoff documents when their phase is authorized.
- Select the technology stack and exact mechanics through research and user discussion; no stack or unverified numeric values are fixed by this setup.

## Context provenance
These instructions summarize the accessible prior planning conversation, including its final handoff discussion. Embedded handoff content references and concept-image assets were not available as standalone documents. The user's latest explicit instructions take precedence over earlier plans and this file.
