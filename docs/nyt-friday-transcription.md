# New York Times: Friday, May 24, 2013

The supplied filled grid identifies the puzzle as May 24, 2013, number 23,208. [XWord Info's listing](https://www.xwordinfo.com/Crossword?date=5%2F24%2F2013) identifies the constructor as Joe Krozel. No printed title was supplied, so the library uses the publication day and date.

## Sources and handling

- `screenshots/nyt-friday-2013-05-24.png`: the supplied completed grid.
- `screenshots/nyt-friday-2013-05-24-clues.png`: the supplied Across/Down clues with answers.

Both inputs contain spoilers. Letters in the filled grid become checking answers, never initial player entries. The player's `rows` contain only dots and blocks, and a fresh visit starts empty. The reference image is collapsed and explicitly labeled **View solution (spoiler)**, including an accurate image description and caption. The clue/answer image remains a preserved source artifact rather than an unmarked clue reference.

## Transcription

The 15×15 grid contains 196 white cells, 36 Across clues and 36 Down clues. Block geometry was transcribed from the completed grid, and all physical answers were compared with the separate clue/answer listing. There is no independently supplied blank grid. The source fixture records the block geometry, filled rows, clue-number sets and both sources. All 72 entries have three authored hints, totaling 216 distinct hints; Down entries are stored in column-major order. The grid needs no rebuses or special input.

66-Across and 67-Across form TATER TOT in the order specified by their clues. Each answer stores only its physical slot letters; the combined snack name is explained inside each answer spoiler.

## Library and validation

The manifest identifies this puzzle as `publication: "NYT"`; existing puzzles are marked `"WSJ"`. The library shows separate publication sections sorted newest first, with counts and links to jump between them. Compact phone rows keep title, author/date and progress together. The personal/family-use legal footer remains intact.

Tests compare every solution letter, crossing, published number, hint count and packaged asset. Interface checks confirm a fresh grid is blank and its solution reference is collapsed and labeled as a spoiler. Library checks cover grouping, sorting, retry behavior, publication validation, completion badges and retained legal-notice text. Phone visual inspection remains manual.
