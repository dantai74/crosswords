# Set a Side transcription

## Sources

- Constructor: Christopher Youngs; editor: Mike Shenk; publication: The WSJ Daily Crossword.
- Date: October 28, 2026, as provided by the user.
- Puzzle and clues: `screenshots/set-aside-2026-10-28.png`.
- Separate solution supplied by the user: `screenshots/set-aside-2026-10-28-solution.png`.

The small “Previous Puzzle's Solution” printed inside the puzzle screenshot belongs to a different puzzle. The separate solution image matches this puzzle and is the answer key used here. It is retained as a source artifact; the page's collapsible reference shows only the puzzle screenshot to avoid exposing answers.

## Transcription and checks

The blank grid's blocks were sampled independently from the first screenshot and checked against the solution image's layout. The grid is 15×15 with 191 white cells, 39 Across entries, and 37 Down entries. The printed start numbers run through 67.

Every answer was transcribed from the supplied key, checked against its printed clue and required length, and verified at all crossings. Across entries retain row-major order; Down entries retain column-major order for the engine. Both displayed clue lists sort by printed number.

The theme entries are 20-Across `KEEPINGABREAST`, 34-Across `TAKENABACK`, 41-Across `THINKAHEAD`, and 55-Across `THEGAMEISAFOOT`. Their endings split into A plus a body part. The revealer, 67-Across `APART`, reinforces the split. Each of the 76 entries has three newly authored hints, with full answers behind the separate spoiler control.

`tests/fixtures/set-aside-source.json` preserves the screenshot-derived block layout, printed clue-number sets, and complete solution rows. Regression tests compare every entry to those solution rows, check all crossings and 228 distinct hints, and mount the puzzle through the shared UI fixture. The manifest registers this as its own puzzle with progress revision 1, keeping its saved letters separate from Final Assessment.
