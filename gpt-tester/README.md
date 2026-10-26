# GPT Tester

QA notes and screenshot evidence for Classic Games live playtests. Keep this folder separate from game code.

## Each test run

Record:
- Game URL and exact commit SHA
- Device/browser and viewport
- Mode, difficulty, speed, and journey length
- Result: finish or crash, distance, score, lives, coins, close calls, bumps
- Findings with severity, exact reproduction steps, expected result, actual result, and evidence links

Separate confirmed observations from suspected causes. Do not change game files as part of a test report.

## Files

- `REPORT-TEMPLATE.md`: copy for each playtest
- `reports/`: dated playtest reports
- `screenshots/`: numbered evidence images, referenced from the matching finding

## Latest report

- [Racer — Easy / Relaxed Full Journey — 2026-10-26](reports/2026-10-26-racer-6cd313d.md)
- The report distinguishes the live sandbox attempts from user-supplied iPhone screenshot evidence.
