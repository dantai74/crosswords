# Jump Scares transcription

## Sources

- Constructor and editor: Mike Shenk; publication: The WSJ Daily Crossword.
- Date: October 29, 2026, supplied by the user.
- Puzzle and printed clues: `screenshots/jump-scares-2026-10-29.png`.
- Separate answer key: `screenshots/jump-scares-2026-10-29-solution.png`.

The small previous-puzzle solution inside the clue screenshot is for Set a Side. It is not the key used for Jump Scares. The separately supplied image matches this puzzle.

## Grid and theme

The grid is 15×15 with 189 white cells, 35 Across clues, and 39 Down clues. Blocks sampled independently from the blank screenshot match the supplied solution. Every physical grid entry has been checked against the key, its printed number, and every crossing. There are three newly authored hints per entry, totaling 222 distinct hints.

Four theme phrases split off BOO into a separately clued neighboring entry:

| Clue | Letters in its slot | Neighbor | Full phrase |
| --- | --- | --- | --- |
| 18-Across | KCOLLECTION | 17-Across: BOO | BOOK COLLECTION |
| 29-Across | SWEETESTTA | 32-Across: BOO | THE SWEETEST TABOO; THE is supplied in the clue |
| 44-Across | STERROCKET | 43-Across: BOO | BOOSTER ROCKET |
| 55-Across | PLAYEDPEEKA | 59-Across: BOO | PLAYED PEEKABOO |

Keep `answer` equal to the physical slot's letters. The full phrase belongs in `answerExplanation`, displayed only inside the answer spoiler; expanding the explanation must not fill cells or change answer checking.

## Registration and tests

The manifest registers a separate puzzle with progress revision 1. `tests/fixtures/jump-scares-source.json` records the source-derived block layout, clue-number sets, and filled solution rows. Tests verify all 189 letters, clue mapping, hint coverage, theme recombination, page assets, and mounting through the shared interface fixture. The original clue screenshot remains the collapsible bottom reference; the separate solution image is retained as a source artifact.
