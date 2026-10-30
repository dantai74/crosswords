# Final Assessment transcription

## Source

The visual source is `screenshots/Screenshot 2026-04-12 at 4.48.05 PM.png`, including its grid and complete printed clue list. The [April 11 puzzle listing](https://dailycrosswordlinks.com/2026/04/11/saturday-april-11-2026/) identifies Randolph Ross's Wall Street Journal puzzle. The [published review](https://crosswordfiend.com/2026/04/10/saturday-april-11-2026/) provides a secondary check on the theme and selected answers. Filename dates refer to the screenshot, not publication.

The solution was reconstructed from the printed clues and checked at every crossing; it is not a downloaded publisher solution key. Hints are newly authored for these entries.

## Corrected transcription

- Grid: 21 rows × 21 columns, with 363 white cells and rotationally symmetric blocks.
- Entries: 61 Across and 77 Down. Published numbering runs through 121, with shared numbers where directions start together.
- Across entries follow row-major order; Down entries follow column-major order to match the existing engine.
- All 138 answers have the correct slot length and agree at all crossings.
- All entries have three distinct, clue-specific hint tiers. Answers are revealed separately on request.

Notable corrections include 19-Across `AVION` (five cells), 64-Across `RONAN` (the surname), and 13-Down `IMET` (four cells). The missing Down clues have been restored with their printed numbers; for example, Stravinsky is 91-Down, and the young fox is 113-Down.

## Regression checks and saves

`tests/fixtures/final-assessment-source.json` pins the screenshot-derived block layout and printed clue-number sets independently of the runtime data. Tests also verify representative clue/answer mappings, complete crossing consistency, hint coverage, and absence of the old repeated placeholders. Structural checks cannot assess the semantic quality of a hint; review each tier against its clue and answer when editing.

Both the puzzle and manifest use `progressRevision: 2`. The corrected grid saves under `crossword.v1.progress.final-assessment-2026-04-12.r2`; the old unversioned record remains untouched. This avoids applying letters from the incorrect 20-column grid to different cells.
