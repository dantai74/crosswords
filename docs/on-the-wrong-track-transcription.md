# On the Wrong Track transcription

## Sources

- Constructor: Brad Wiegmann; editor: Mike Shenk; publication: The Journal Weekend Puzzles.
- Date: October 17, 2026, using the user-supplied month and day.
- Puzzle and printed clues: `screenshots/on-the-wrong-track-2026-10-17.png`.
- Separate answer key: `screenshots/on-the-wrong-track-2026-10-17-solution.png`.

## Grid and theme

The 21×21 grid contains 363 white cells, 67 Across clues and 73 Down clues. Blocks sampled independently from the blank screenshot match the answer key. Every entry matches its printed number and crossing answers. Each clue has three authored, progressively specific hints: 420 distinct hints in total.

The theme pairs songs with characters who would find their titles unwelcome:

| Across | Song in the grid | Character |
| --- | --- | --- |
| 22 | SAYMYNAME | Rumpelstiltskin |
| 27 | ILLTUMBLE4YA | Jack and Jill |
| 32 | BRICKHOUSE | Big Bad Wolf |
| 50 | CROCODILEROCK | Captain Hook |
| 66 | BADLIAR | Pinocchio |
| 81 | SPINNINGWHEEL | Sleeping Beauty |
| 95 | FREEFALLIN | Humpty Dumpty |
| 102 | SOAKUPTHESUN | Dracula |
| 112 | HOTHOTHOT | Frosty the Snowman |

The supplied solution explicitly uses a single-cell numeral `4` at row 4, column 19 (one-based), crossing 27-Across and 15-Down, `ACT4`. Do not replace it with FOUR or A. The shared validator, input and progress persistence accept letters and digits. The phone keyboard adds only digits used by the puzzle; existing puzzles retain their usual keyboard.

## Registration and verification

The manifest registers this puzzle separately with progress revision 1. `tests/fixtures/on-the-wrong-track-source.json` preserves the independently sampled block layout, clue numbers and transcribed solution rows. Regression tests check every answer, all 363 cells, hint uniqueness, theme entries, phone mounting, digit entry and saved numeric progress. The clue screenshot remains the collapsible reference at the bottom of the page; the separate answer key is retained as a source artifact.
