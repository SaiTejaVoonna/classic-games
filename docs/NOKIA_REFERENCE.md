# Nokia Snake II reference — initial research
Research date: 2026-10-19. Status: evidence inventory, not an implementation-ready ruleset.

## Target and evidence policy
Target the original monochrome Nokia 3310 Snake II, not the 2017 phone, Snake Xenzia, Snake EX, or another handset's rules. The exact firmware/region is not yet pinned.
- **Verified / 3310:** a Nokia-authored document explicitly about the target.
- **Corroborated / different model or replica:** useful lead, not proof for 3310.
- **Unknown:** no adequate target-specific evidence collected. Do not turn into a constant or claim of fidelity.
A manufacturer-authored manual hosted by a mirror is primary content; the mirror is not the manufacturer. No original hardware, firmware execution, or gameplay recording was measured in this pass.

## Sources inspected
[S1] [Nokia 3310 User's Guide, ©2001, printed p.80 / PDF page 80](https://www.manuallib.com/download/NOKIA-3310-USER-GUIDE.PDF#page=80). Target-specific primary document. Its games section describes common options but not the full in-game instructions or numeric engine rules.

[S2] [Nokia 3395 User Guide, issue 2, ©2001–2002, printed p.111 / PDF page 124](https://www.instructionsmanuals.com/sites/default/files/2019-05/Nokia-3395-en.pdf#page=124). Related-model primary document; menu outline at printed p.25 / PDF p.38. Do not import its options or maps as verified 3310 behavior.

[S3] [Nokia Devices Blog, “Snake 2k slithers onto your Nokia Lumia,” 25 June 2012](https://blogs.windows.com/devices/2012/06/25/snake-2k-slithers-onto-your-nokia-lumia/). Manufacturer editorial about a third-party replica of 3310 Snake. Evidence about that replica, not original implementation.

Modern clone code and unsourced recollections are not accepted as historical constants.

## Findings
| Topic | Evidence status | Finding and implementation consequence |
| --- | --- | --- |
| Target game | Verified / 3310, S1 | Snake II is among the bundled games. |
| Core menu functions | Verified / 3310, S1 | New game starts a run; Top score displays the highest score; Instructions provides help; Level changes difficulty; Continue resumes a paused run. Preserve these functions. |
| Settings scope | Verified / 3310, S1 | Sounds, lights and vibration are described. Browser theme/audio/haptics equivalents are adaptations, not literal hardware emulation. |
| Pause/resume | Partly verified / 3310, S1 | Pausing and Continue exist. Some keys appear as symbols in the manual; text extraction loses them. Exact key identities and first resumed movement require visual/hardware verification. |
| Food/growth, keypad, collision | Corroborated / 3395, S2 | Related model describes feeding/growth, keys 2/4/6/8, and death on own tail or walls. Exact 3310 input and collision order remain open. |
| Mazes | Corroborated / 3395, S2 | Clear field and five mazes are documented there. S1's short common-options list does not establish 3310 maze count, layout or menu location. Absence from that list does not establish absence from the game. |
| Four directions, temporary bonus creatures | Replica corroboration, S3 | Replica article describes these features. This supports further investigation, not an exact bonus formula. |

## Unresolved mechanics register — implementation blockers
| ID | Required fact | Current status | How to resolve |
| --- | --- | --- | --- |
| U01 | Playfield columns/rows, aspect, cell occupancy and HUD exclusion | Unknown | Count original pixels/cells from an identified handset recording and cross-check edge-to-edge travel. Display resolution alone cannot establish the grid. |
| U02 | Number of speed levels; exact milliseconds/tick at each; any acceleration | Unknown | Record repeated straight travel per level with timestamps; use multiple runs and report measurement error. |
| U03 | Initial snake length, occupied cells, direction and first-move trigger | Unknown | Capture New game start, including input timing. |
| U04 | Immediate reversal handling, turn queue depth/order, key repeat and same-tick input | Unknown | Repeated controlled key sequences on the chosen firmware. |
| U05 | No-maze wrap behavior; obstacle/border collision per maze | Unknown for target | Film all four edges in clear field and each maze. Do not assume all borders are lethal or all wrap. |
| U06 | 3310 maze count, exact coordinates, start positions, selection semantics | Unknown | Capture menu plus every map from the same target. Keep maps as data with evidence IDs. |
| U07 | Ordinary food points per level, growth count/timing, food spawn exclusions | Unknown | Log before/after scores and lengths, including occupied-cell cases. |
| U08 | Bonus trigger frequency, duration, countdown clock, reward formula, missed-bonus behavior and growth | Unknown | Repeat timed collections and misses across levels; distinguish ticks from elapsed seconds. |
| U09 | Tail-vacating-cell collision order, growth interaction, simultaneous food/collision | Unknown | Controlled boundary-case traces, not generic Snake conventions. |
| U10 | Full-board termination, game-over UI, score ties and top-score persistence | Unknown | Reproducible runs and power/session transitions. |
| U11 | Pause/start/continue, changing level/maze during a paused run | Unknown beyond S1 menu functions | Record state before and after each action; verify no hidden movement on resume. |
| U12 | Sound event mapping and vibration behavior | Unknown | Observe device settings/events. Use independently synthesized browser feedback only with approval. |

## Evidence collection and acceptance gate
1. Identify physical 3310 model, firmware version, region/language, and any customization. Agree with owner on the exact reference version.
2. Obtain owner-provided hardware observations or a clearly identified original-device recording. Do not request or distribute proprietary firmware assets.
3. Record source URL/file, timestamp range, input sequence, observed output, repeats, uncertainty, and observer for every claim.
4. Create trace fixtures once evidence is sufficient; Codex independently reviews each rule before Claude receives engine tasks.
5. Keep unresolved rules blocked. An owner-approved approximation must be labeled as such; approval does not make it historically verified.

## What this pass does not establish
No exact grid size, level timing, scoring equation, bonus schedule, maze geometry or original turn-buffer semantics has been verified. The generated desktop/mobile images are presentation sketches, not evidence: their square boards, scores, level numbers and snake paths must not determine rules.
