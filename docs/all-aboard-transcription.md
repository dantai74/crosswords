# All Aboard! transcription

## Sources

- Constructor: Jerry Miccolis; editor: Mike Shenk; publication: The WSJ Daily Crossword.
- Date: September 9, 2026, using the user-supplied month and day.
- Puzzle and printed clues: `screenshots/all-aboard-2026-09-09.png`.
- Separate answer key: `screenshots/all-aboard-2026-09-09-solution.png`.

The separate image is headed “Previous Puzzle’s Solution” and matches this puzzle’s grid and clues.

## Grid and theme

The 15×15 grid has 189 white cells, 39 Across clues and 39 Down clues. Blocks sampled independently from the blank screenshot match the solution image. Each entry matches its printed number, the supplied key and every crossing. There are three authored hints per clue, totaling 234 distinct hints.

Five Across entries turn familiar words or phrases into vessels for particular occupations:

| Across | Entry | Wordplay |
| --- | --- | --- |
| 16 | SOFTLAUNCH | Pillows are soft; a launch is a small boat. |
| 23 | SCHOLARSHIP | Academics are scholars; a ship is a vessel. |
| 34 | HEADLINER | Lettuce grows in heads; a liner is a passenger ship. |
| 48 | NAILCLIPPER | Carpenters use nails; a clipper is a sailing ship. |
| 57 | STAGECRAFT | A stage is a coach; craft can mean a boat. |

Store complete physical entries in `answer`. Theme explanations belong in `answerExplanation`, displayed inside the answer spoiler.

## Registration and verification

The manifest registers a separate puzzle with progress revision 1. `tests/fixtures/all-aboard-source.json` records the independently sampled grid, clue-number sets and filled solution rows. Tests verify all answers and 189 solution cells, hint coverage and uniqueness, theme entries, manifest registration, page assets and phone mounting. The original clue screenshot remains the collapsible reference at the bottom of the page. The separate answer key is preserved as a source artifact.
