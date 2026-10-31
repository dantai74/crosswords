# LLM context: crosswords interactive web app

Use this file when continuing work on this repository. It encodes architecture, data contracts, and pitfalls so the next agent does not rediscover them by trial and error.

## Required LLM workflow

An image-capable LLM coding assistant with repository access is required for the current puzzle-preparation workflow. The assistant performs screenshot interpretation, transcription, answer reasoning, clue-specific hint authoring, file creation, and verification. The app provides a static player for those prepared artifacts; it has no integrated LLM service or automatic screenshot importer. Existing puzzles run without an LLM connection or API key.

When asked to add a puzzle:

1. Use the supplied puzzle screenshot, separate matching solution image, and date. Preserve originals under `screenshots/`; distinguish the current key from any unrelated previous-puzzle key printed on the clue page.
2. Transcribe the grid and complete clue list, preserving published numbers. Compare the blank grid with the solution layout independently.
3. Verify every answer against the supplied key, its slot length, and all crossings. If reconstructing without a key, document that distinction and flag unresolved uncertainty for review; passing crossing checks is not proof of the publisher's solution.
4. Write three useful, increasingly specific hints per clue. Store physical slot letters in `answer` and any full-phrase theme explanation in `answerExplanation` for the spoiler control.
5. Create matching `web/puzzles/<slug>.html` and `<slug>.data.js` files, register the puzzle in `web/manifest.json`, preserve source fixtures in `tests/fixtures/`, and add transcription notes in `docs/`.
6. Run `make test`, including source comparisons, numbering, answer lengths, crossings, hint coverage, registration, and shell mounting. Report the result and direct the user to reload `/crosswords/`; newly added static puzzle files need no server restart.

## Intent

- **Input:** Periodic **PNG screenshots** of newspaper-style crosswords (stored under `screenshots/`).
- **Output:** Static **HTML/JS/CSS** under `web/` — one puzzle page per puzzle, plus a **master index** with **progress** (filled cell count vs total; optional correct/checkable after checks run).
- **Hints:** Each word has the **published clue** (`clue`) plus three authored **`hints[]`**, shown as gentle, more specific, and strong hints. The full answer is behind a separate spoiler control. No runtime algorithm generates semantic hints.
- **Solutions:** Final Assessment contains a complete solution reconstructed from the screenshot's clues and checked at all crossings; see `docs/final-assessment-transcription.md`. Set a Side contains a complete solution verified against the separate user-supplied solution screenshot; see `docs/set-aside-transcription.md`.

## Directory map

```
crosswords/
  README.md                 # Human-oriented overview
  docs/
    LLM-CONTEXT.md            # This file
  screenshots/                # User-provided PNGs (source of truth visually)
  web/
    index.html                # Fetches manifest.json; lists puzzles + progress
    manifest.json             # { "puzzles": [ { id, title, author, date, href, screenshot, whiteCellCount }, ... ] }
    styles.css
    screenshots/              # Often symlink → ../screenshots (so http.server from web/ serves /screenshots/…)
    shared/
      progress.js             # localStorage: crossword.v1.progress.<puzzleId>
      puzzle-app.js           # CrosswordEngine: grid → words, cell map, labels, correctness vs answers
      puzzle-shell.js         # Crossword UI: mountCrosswordPuzzle(rootEl)
    puzzles/
      <slug>.html             # Loads shared/*.js + <slug>.data.js; calls mountCrosswordPuzzle(#app)
      <slug>.data.js          # window.PUZZLE_DATA = { … }
```

## Runtime requirements

- **Run `make`** from the repository root. Its local server mounts `web/` at `http://localhost:8000/crosswords/`, disables browser caching, and opens Chrome. The root URL and legacy paths redirect into `/crosswords/`. Opening `file://` is unsuitable because the index fetches its manifest over HTTP.
- **Image paths:** Puzzle pages reference screenshots as `../screenshots/...` from `puzzles/*.html`. Under the mount this resolves to `/crosswords/screenshots/...`, served from `web/screenshots/...` — use a symlink or copy from repo `screenshots/`.

## GitHub Pages deployment

- `.github/workflows/pages.yml` validates and packages on pushes and pull requests to `main`, plus manual dispatch. Only main-branch pushes/manual runs deploy. The deploy job depends on the build and uses the `github-pages` environment with `pages: write` and `id-token: write` permissions.
- One-time repository setup: **Settings → Pages → Build and deployment → Source → GitHub Actions**. The expected site address is `https://dantai74.github.io/crosswords/`.
- `make pages` recreates `_site/` from `web/`, replacing its screenshot symlink with copied images from `screenshots/`, dropping `.DS_Store`, and adding `.nojekyll`. `_site/` is generated and ignored by Git. Do not put another `crosswords/` directory inside the artifact: GitHub provides that path prefix.
- The hosted player is entirely static. It uses browser-local progress; separate browsers/devices have separate saves. Localhost saves do not automatically migrate to the production origin. Account-based synchronization and export/import are not implemented.
- `tests/pages.test.cjs` packages the app in a temporary workspace, checks for symlinks, resolves page and screenshot URLs against the production subdirectory, and verifies packaging also works without the local screenshot symlink.

## Data contract: `window.PUZZLE_DATA`

Defined in each `puzzles/<slug>.data.js`.

| Field              | Type     | Notes                                                                         |                                          |
|--------------------|----------|-------------------------------------------------------------------------------|------------------------------------------|
| `id`               | string   | Unique; used in localStorage key `crossword.v1.progress.<id>`                 |                                          |
| `title`, `author`  | string   | Display                                                                       |                                          |
| `sourceScreenshot` | string \ | optional                                                                      | Relative URL; shown as reference `<img>` |
| `rows`             | string[] | Each string one row; `.` = letter cell, `#` = block; **all rows same length** |                                          |
| `across`           | Entry[]  | Length must equal count of across words (len ≥ 2) extracted from `rows`       |                                          |
| `down`             | Entry[]  | Length must equal count of down words extracted from `rows`                   |                                          |

**Entry** (across/down):

```ts
{ pub: number, clue: string, hints: string[], answer: string }
```

- **`pub`:** Published clue number from the paper (shown in grid corner via `CrosswordEngine.buildLabels`). Must align **by index** with the order of words returned by `extractWords` (row-major scan for across; column-major for down — see `puzzle-app.js`).
- **`clue`:** Basic hint (verbatim from publication).
- **`hints`:** Extended hints; empty array shows “No extended hints…” in UI.
- **`answer`:** Full entry using letters or digits, uppercase ignored; **empty string** means that word does not contribute to “Check known letters”. Partial solution support is not implemented per-cell; fill whole word when known.
- **`answerExplanation`:** Optional non-empty string shown only inside the answer spoiler. For split theme answers, `answer` must contain the physical slot's letters; explain the full phrase and where the other letters went here. Jump Scares uses this for its four separated BOO phrases.
- **`progressRevision`:** Optional positive integer shared with the manifest entry. When grid corrections change coordinates, increment it to use a separate save slot; retain the stable puzzle `id`.

## Critical implementation details

### `CrosswordProgress` (`progress.js`)

Must export:

- `loadProgress(puzzleId, rows?, revision?)` sanitizes saved cells and optional statistics; supplying rows discards cells outside the current white grid.
- `saveProgress(puzzleId, payload, revision?)`, `clearProgress(puzzleId, revision?)` return a success boolean instead of throwing on storage failures. The shell shows a status message when saving fails and keeps the in-memory puzzle usable.
- `key(puzzleId, revision?)` appends `.r<revision>` when present; `statsForPuzzle(meta)` uses `meta.progressRevision`. The original unversioned save is preserved when the grid is corrected.
- `countFilledCells(cells, rows)`
- **`countWhiteCells(rows)`** — **required** by `puzzle-shell.js` on mount. Omitting it caused a silent empty `#app` (exception before DOM build) until fixed.
- `statsForPuzzle(meta)` — `meta.whiteCellCount` should be set in `manifest.json` so the index shows percent before first visit.

Saved payload (conceptually): `{ cells: { "r,c": "A" }, filled, total, correctCount?, checkable?, updatedAt }`.

### `CrosswordEngine` (`puzzle-app.js`)

- `validatePuzzle(data)` checks grid shape, clue counts and entry types, published start numbers, answer lengths, isolated cells, and crossing consistency before mounting; returns the extracted words or throws a descriptive error.
- `numberGrid(rows, across, down)` numbers unique word starts in row-major order. Validate each entry's `pub` against its slot, even though the Down array is column-major.
- `extractWords(rows)` — across/down word list with `{ r, c, len }`.
- `buildCellMap`, `buildLabels` — `acrossPub`/`downPub` parallel arrays from `PUZZLE_DATA.across[].pub` and `.down[].pub`.
- `countCorrectCells` / `letterFromAnswerAt` — only cells where expected letter can be derived from non-empty `answer` strings.

### `puzzle-shell.js`

- `mountCrosswordPuzzle(rootEl)` expects `global.PUZZLE_DATA` already set.
- Dispatches `CustomEvent("crossword-progress", { detail: { id } })` on save; `index.html` listens to refresh the table.
- Grid uses one `<input maxlength=1>` per white cell with only the active cell in the tab order; double-click and Space toggle direction, arrows move without changing the current direction, and Tab/Shift+Tab leave the grid. Direction buttons provide the same action explicitly. If the destination has no word in the selected direction, focus falls back to its available word. Initial focus uses the first white cell.
- Hint contents rebuild only when the active word changes, preserving expanded hints while typing within that word.
- When the active word changes, its clue list scrolls to reveal the highlighted row. Adjust only the list's `scrollTop`, preserving grid focus and the document's scroll position; already visible rows and moves within the same word do not scroll.
- Cells are 36.4px (30% larger than the original 28px), with proportionally larger letters and numbers. The active word is highlighted.
- At 1160px and wider, the active clue and hints sit beside the grid; Across and Down lists sit below. Lists display in numerical order, preserving original array indices for grid selection. At 640px the clue lists become two columns. The screenshot is in collapsed reference details after the main layout.
- Phone mode is detected with `matchMedia`: a coarse pointer plus width ≤760px or height ≤520px. Matching CSS queries keep phone changes isolated from desktop. The media-change handler restores native editing when leaving touch mode.
- On phones, the title/header and top library navigation are hidden so the active clue panel comes first. The filled-letter count moves into the clue metadata line, right-aligned beside the direction, number, and length; leaving phone mode moves it back to the desktop header. Hints remain in collapsed outer details. The grid is the sole letter-selection and entry surface.
- The phone keyboard uses read-only inputs with `inputMode="none"` to suppress the system keyboard. Physical letter, digit, and backspace keys still work. Digits present in a puzzle’s answers are added before backspace in the phone keyboard’s bottom row. Visual cell letters use a separate `aria-hidden` span sized to the grid, while the input font stays 16px to avoid focus zoom. Desktop uses normal editable inputs and hides the extra span and phone controls.
- Touch input, native input, and backspace share `writeCell`/`eraseLetter`, including persistence, mistake clearing, and auto-advance. The keyboard's top row has < / > buttons for previous/next clue and a separate hide toggle; it has no direction/letter-position caption or Next key in the letter rows. Clue navigation sorts published numbers independently of engine slot order. Keep direction unchanged on arrows. Zoom reveals the active square within the grid; touch focus uses `preventScroll` and explicitly keeps the square between the clue panel and fixed keyboard.
- The on-screen keyboard can collapse, and tapping a grid cell restores it. Separate All across clues / All down clues buttons scroll to the corresponding section. A bottom All puzzles link keeps library navigation accessible on phones; source screenshots remain at the bottom. Phone library rows become cards with progress and last-played labels.

### Regression checks

- `tests/fixtures/all-aboard-source.json` records the September 9 puzzle: 189 cells, 78 entries and 234 distinct hints. Five Across theme entries combine an occupation-related word with a vessel name; explanations stay inside answer spoilers.

- `tests/fixtures/on-the-wrong-track-source.json` records the 21×21 October 17 puzzle: 363 cells, 140 entries and 420 distinct hints. Its literal numeral `4` crosses `ILLTUMBLE4YA` and `ACT4`; retain that single-cell digit in answers, input, saved progress and checking.

- Run `node --test tests/*.test.cjs` from the repository root; no npm dependencies are required.
- Tests pin the bundled grid and clue-number sets to `tests/fixtures/final-assessment-source.json`, verify all 363 solution cells and 414 distinct hints, and cover extraction order, numbering, storage revisions/sanitization/failure, and index loading/retry paths. `tests/interface.test.cjs` exercises mounting and interactions with a small DOM fixture, including sorted clue selection and double-click direction switching. Browser layout checks remain manual; see `README.md`.
- `tests/fixtures/set-aside-source.json` records Set a Side's independently transcribed blank grid and supplied solution rows; tests verify all 191 cells, 76 entries, 228 distinct hints, manifest registration, and shell mounting.
- `tests/fixtures/jump-scares-source.json` similarly records Jump Scares: 189 cells, 74 entries, and 222 distinct hints. Tests verify that each theme fragment combines with its neighboring BOO entry and that explanations stay inside answer spoilers.

## Invariants and validation

- `across.length` === number of across slots (geometric) from `rows`.
- `down.length` === number of down slots.
- `manifest.json` `whiteCellCount` should equal count of `.` in `rows` for that puzzle.
- If `pub` order does not match geometric word order (because `rows` was transcribed wrong), clues will bind to the wrong entries — fix `rows` or reorder clue arrays carefully.

## User workspace rule (Cursor)

- **Python utilities:** Prefer `~/bin`, not a repo `scripts/` folder, unless the user asks to version scripts in the project.

## Extension ideas (not implemented)

- `.puz` import or OCR from PNG.
- Per-cell reveal; PWA offline cache.
- Build script to generate `.data.js` from a spreadsheet.
