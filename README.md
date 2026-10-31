# Crosswords (interactive web player)

Browser-based crossword puzzles with **local progress**, **tiered hints** (published clue + extended hints), and optional **checking** against answers stored in data files.

## LLM requirement

**An LLM is required for this project's current workflow for adding puzzles.** Use an image-capable LLM coding assistant with access to this repository to read screenshots, transcribe grids and clues, verify or reconstruct answers, write useful hints, and produce the puzzle files. This preparation happens through the assistant; there is no automatic screenshot importer in the app.

Once prepared, puzzles run as static HTML, JavaScript, and CSS. Playing existing puzzles requires no LLM connection or API key. Python serves local files; GitHub Pages serves the published version. The browser handles interaction and saved progress.

## Quick start

1. From the repository root, start the local server (requires macOS, Google Chrome, Make, and Python 3):

   ```bash
   make
   ```

2. Chrome opens automatically at `http://localhost:8000/crosswords/` (or the port shown in the terminal).

3. Pick a puzzle from the list. Progress is saved in **localStorage** for this browser only.

Press **Ctrl+C** to stop. To use another port, run `make PORT=8080`.
The Make server disables browser caching so edited scripts and puzzle data reload together. After upgrading an already running server, stop and restart `make`, then reload the page.
The app is served under `/crosswords/`; the server root and older puzzle URLs redirect there. Saved progress is retained when using the same hostname and port.

Click a square to select it; **double-click** or press **Space** to switch Across/Down. You can also use the direction buttons above the active clue. Arrow keys move between cells while keeping your current word direction, and **Tab** or **Shift+Tab** move out of the grid. Extended hints stay open while moving within the same word.

The grid uses larger cells with the active word highlighted. On wide screens, the active clue and hints sit beside the grid. Across and Down lists appear below, each sorted by its published clue number. When you move to a new clue, its list scrolls just enough to show the highlighted row. On narrow screens the panels stack, and the grid scrolls horizontally. The original screenshot is a collapsible reference at the bottom.

Each entry has a gentle hint, a more specific hint, and a strong hint. Open them individually as needed. **Reveal answer (spoiler)** is a separate control; opening it does not fill in your grid.

Click any blue, underlined word in the active clue or either clue list, such as **Orly**, to search Google for that word's meaning in a new tab. The lookup searches only the selected word. In the clue lists, click the numbered button to select the clue in the grid.

If browser storage is unavailable or full, a status message appears and you can keep solving in memory. Those changes may be lost when you leave the page.

## Phone controls

Small touch screens automatically get a phone layout based on screen size and pointer capability. Desktop layout and physical-keyboard controls remain available as before.

- **Grid fits the screen:** tap a square, or use **Zoom grid** for larger cells and pan around. **Fit grid** returns to the full-board view.
- **Active clue comes first:** the phone hides the page title and top library link. The compact clue panel shows direction controls, the current clue, and hints, with the filled-letter count right-aligned beside the clue number and length. Select and enter letters directly in the grid.
- **Crossword keyboard:** letter keys fill and advance in your chosen direction; delete clears a letter. The **<** and **>** buttons above the keys move to the previous or next clue in numerical order. The direction button shows **Across →** or **Down ↓** and toggles between them. The blue navigation keys are twice their former width and match the letter-key height. Compact green **✓** (check filled cells) and muted red **trash** (clear progress after confirmation) icons leave room for navigation. The duplicate navigation row in the active clue panel is hidden on phones. It replaces the phone keyboard while solving, avoiding autocorrect and repeated keyboard popups. Connected physical keyboards still work.
- **Hints on demand:** tap **Hints & answer** to expand the existing hint tiers and spoiler control. Across/Down buttons switch direction.
- **More room when needed:** hide the crossword keyboard to read clues or the reference image; tapping a grid square brings it back. **Clues** opens a panel from the bottom with Across/Down tabs. Choose a clue to close the panel and return to the grid; desktop retains both lists below the puzzle. **All puzzles**, below the lists, returns to the library.

- **Resume where you left off:** the selected square, direction, zoom and grid scroll are saved on this device for each puzzle.
- **Undo mistakes:** **↶ Undo** beside delete restores typing, overwrites, deletion or a confirmed Clear. Desktop also has an Undo button and Ctrl/Command+Z. Undo retains the last 100 edits during the current visit; reopening starts a fresh undo history.
- **Finish a puzzle:** a fully correct grid displays a small celebration and a link to the library, where it is marked **Completed**. A full grid with errors prompts you to check without identifying mistakes automatically. Partial answer keys cannot certify completion.

The puzzle library also becomes a list of cards on phones. Saved progress and Google meaning links work the same way as on desktop.

## Publish with GitHub Pages

The deployment workflow is [`.github/workflows/pages.yml`](.github/workflows/pages.yml). After these changes are committed and pushed, enable it once:

1. Open the repository's [Pages settings](https://github.com/dantai74/crosswords/settings/pages).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or open **Actions → Deploy GitHub Pages → Run workflow**, selecting `main`.
4. Wait for the workflow to finish, then open **https://dantai74.github.io/crosswords/**.

The workflow runs `make test`, packages the static files, and deploys only after validation succeeds. Pull requests run validation and packaging without publishing; pushes to `main` publish updates automatically. No deployment secret or external server is needed; the workflow uses GitHub's built-in token. See [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To inspect the same deployable package locally, run:

```bash
make pages
```

This recreates the ignored `_site/` directory with the contents of `web/` and real copies of `screenshots/`. It replaces the local screenshots symlink, removes `.DS_Store`, and adds `.nojekyll`. The artifact's `index.html` belongs at its root; GitHub supplies the `/crosswords/` URL prefix. A production build does not run `make` or Python on visitors' devices.

Family members each get their own progress when using separate devices or browsers. Progress remains local to each browser; the site currently has no sign-in, cloud synchronization, or progress export/import. Existing localhost progress does not transfer automatically to the GitHub Pages domain. On a shared browser, people share one progress record per puzzle.

## Validation and tests

With Node.js installed, run the regression suite from the repository root:

```bash
make test
```

The suite checks puzzle data against a source screenshot fixture, complete crossing answers, hint coverage and repeated placeholders, clue numbering, saved-progress sanitization and revisions, storage failures, and index loading/retry behavior. DOM fixtures exercise shell mounting, sorted clue selection, double-click switching, and hint persistence. Deployment tests build a standalone package and verify that page links, scripts, and screenshots resolve under `/crosswords/`, with no symlinks. No npm dependencies are required.

For UI changes, also serve `web/` and check keyboard entry and navigation, Tab/Shift+Tab leaving the grid, double-click and Space switching direction, hint expansion while typing, progress after reload, and the desktop layout above and below 1160px viewport width. The desktop clue lists become two columns at 640px; small touch screens use the separate phone layout.

For phone changes, check Safari on iPhone and Chrome on Android at narrow widths (including 320px and 390px), both grid sizes, portrait/landscape rotation, the fitted and zoomed grid, square selection, delete/next, keyboard hiding, expanded hints, and returning from a Google lookup. Phone interaction tests use a DOM fixture; real-device visual and touch checks remain manual.

## Project layout

| Path                         | Purpose                                                           |
|------------------------------|-------------------------------------------------------------------|
| `web/index.html`             | Master index: reads `manifest.json`, shows per-puzzle progress    |
| `web/manifest.json`          | Registry of puzzles (`id`, `href`, `whiteCellCount`, etc.)        |
| `web/puzzles/<slug>.html`    | One page per puzzle; loads shared JS + a `.data.js` file          |
| `web/puzzles/<slug>.data.js` | `window.PUZZLE_DATA` — grid, clues, hints, answers                |
| `web/shared/`                | `progress.js`, `puzzle-app.js`, `puzzle-shell.js`                 |
| `web/styles.css`             | Shared styles                                                     |
| `screenshots/`               | Source PNGs (your inputs)                                         |
| `web/screenshots/`           | Symlink to `../screenshots` so the static server can serve images |

If `web/screenshots` is missing (e.g. after clone on Windows), recreate it or copy PNGs into `web/screenshots/`.

## Adding a new puzzle with an LLM

1. **Provide the inputs:** send the assistant a puzzle screenshot, its separate solution image, and the puzzle date. Include the full grid and all printed clues.
2. **Transcribe:** the assistant records the title, author, block layout, published clue numbers, and clue text. A small “Previous Puzzle's Solution” inside the clue screenshot may belong to another puzzle; use the matching separate solution.
3. **Verify answers:** compare every entry with the supplied key, its required length, and all crossing letters. For split theme answers, preserve the physical slot letters and explain the full phrase separately.
4. **Prepare hints:** write three clue-specific tiers for every entry—gentle, more specific, and strong—with full answers and theme explanations behind the spoiler controls.
5. **Add to the library:** preserve both source images, create the HTML/data pair, update the manifest, and add source fixtures and transcription notes.
6. **Validate and reload:** the assistant runs `make test` and reports any unresolved uncertainty. Reload `http://localhost:8000/crosswords/` to see the new puzzle. Adding puzzle files does not require restarting the server.

For example, send the two images with:

> Add this puzzle for October 29, 2026. Verify every answer against the supplied solution, write three hints per clue, register it in the library, and run the tests.

Without a matching solution image, the LLM can solve from clues and crossings. Record that provenance as reconstructed rather than key-verified, flag unresolved entries, and review uncertainty before adding the puzzle. Automated checks establish structural consistency; they cannot independently establish that an inferred answer or hint is correct.

### Files the assistant updates

1. Save the puzzle and solution images under `screenshots/`, using clear filenames such as `<slug>.png` and `<slug>-solution.png`.
2. Copy an existing pair in `web/puzzles/` (e.g. `final-assessment-2026-04-12.html` + `.data.js`) to new names.
3. Update the new `.html` to load the new `.data.js`.
4. Edit the new `.data.js`:
   - `id` (unique, stable; used as localStorage key)
   - `progressRevision` (optional positive integer; bump it when correcting a grid so old coordinates are not reused)
   - `title`, `author`, `publishedDate`, `sourceScreenshot` (image path relative to the puzzle HTML file, usually `../screenshots/…`); retain the separate key as `solutionScreenshot` when supplied
   - `rows`: strings of `.` (white) and `#` (black), **fixed width**, one row per grid line
   - `across` / `down`: arrays of `{ pub, clue, hints[], answer }` aligned with **word order** from the grid (see `docs/LLM-CONTEXT.md`)
   - `answerExplanation` (optional per entry): full-phrase or theme explanation shown inside the answer spoiler
5. Count white cells (`"."` in `rows`) and set `whiteCellCount` for that puzzle in `manifest.json`.
6. Register the puzzle in `manifest.json` → `puzzles`, keeping the newest dates first and matching its `progressRevision`.
7. Add a source fixture under `tests/fixtures/`, document provenance under `docs/`, and run `make test` to check registration, numbering, answer lengths, crossings, hints, page assets, and shell mounting.

Puzzle pages validate the grid, clue counts, answer lengths, and crossing answers before rendering. Saved letters outside the current grid or with invalid values are discarded. The index requires unique puzzle IDs, a positive integer `whiteCellCount`, and relative `puzzles/<slug>.html` links; loading errors offer a Retry button.

## Checking answers

“Check known letters” only compares cells where the solution letter can be inferred from non-empty `answer` strings on entries. Fill in `answer` per word in the `.data.js` file as you obtain the key.

The button marks incorrect filled cells red in the grid. It leaves empty cells alone and does not fill in answers. All currently bundled puzzles have complete solutions, so every filled cell can be checked. Correcting a letter removes its red marker; check again to verify the replacement.

The bundled **Final Assessment** puzzle has a corrected 21×21 grid, all 138 entries, and a complete solution checked at every crossing. It was published April 11, 2026; April 12 in the filenames is the screenshot date. The corrected grid uses progress revision 2. Saves from the earlier incorrect grid remain under their original localStorage key, while the corrected grid starts fresh.

**Set a Side**, by Christopher Youngs (October 28, 2026), is also included. Its 15×15 grid has 76 entries and 228 authored hints; every answer was verified against the supplied solution screenshot. See [its transcription notes](docs/set-aside-transcription.md).

**Jump Scares**, by Mike Shenk (October 29, 2026), has 74 entries and 222 hints, verified against the supplied solution. Four theme answers have a separate neighboring `BOO` entry; the grid accepts the exact fragments shown in the key, and each answer spoiler explains the full phrase. See [its transcription notes](docs/jump-scares-transcription.md).

**On the Wrong Track**, by Brad Wiegmann (October 17, 2026), has a 21×21 grid, 140 entries, and 420 authored hints verified against the supplied answer key. Its theme pairs songs with characters who would rather not hear them. The numeral `4` occupies one square in `ILLTUMBLE4YA` and `ACT4`; phones show a `4` key for this puzzle. See [its transcription notes](docs/on-the-wrong-track-transcription.md).

**All Aboard!**, by Jerry Miccolis (September 9, 2026), has 78 entries and 234 authored hints in a 15×15 grid. Answers match the supplied solution; five theme entries combine an occupation-related word with a type of vessel. See [its transcription notes](docs/all-aboard-transcription.md).

## Writing hints

Hints are authored in each entry's `hints` array, not generated at runtime. Write three clue-specific tiers: explain the interpretation, narrow the meaning or reference, then provide a strong nudge. For puns, explain the wordplay; for names, identify the relevant person without substituting the wrong part of the name. Keep the full answer in `answer` for the separate spoiler control. Do not fill hint tiers with generic solving advice or a restatement of the grid length.

Verify the screenshot's geometry, published clue numbers, and every answer crossing before writing hints. See [the transcription notes](docs/final-assessment-transcription.md) for the bundled puzzle's provenance and checks.

## Agent / automation note

For Cursor and other agents, see **`docs/LLM-CONTEXT.md`** for schema details, invariants, and common failure modes.
