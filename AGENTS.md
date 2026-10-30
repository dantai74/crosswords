# Repository Guidelines

## Project Structure & Module Organization

- `web/index.html` lists puzzles from `web/manifest.json`.
- `web/puzzles/` contains matching `<slug>.html` and `<slug>.data.js` files; data files define `window.PUZZLE_DATA`.
- `web/shared/` contains the grid engine (`puzzle-app.js`), UI (`puzzle-shell.js`), and localStorage persistence (`progress.js`).
- `web/styles.css` provides shared styling. Source images live in `screenshots/`; `web/screenshots` exposes them to the server through a symlink or copied files.
- Read `README.md` and `docs/LLM-CONTEXT.md` for setup, data contracts, and implementation pitfalls. There is no dedicated test directory.

## Build, Test, and Development Commands

Run from the repository root:

```sh
python3 -m http.server --directory web
```

Open `http://localhost:8000/`. HTTP serving is required for reliable manifest fetching. There is no build step, dependency installation, or configured lint/test command.

To check manifest syntax:

```sh
python3 -m json.tool web/manifest.json > /dev/null
```

## Coding Style & Naming Conventions

Follow existing two-space indentation, double-quoted JavaScript strings, and semicolons. Use camelCase for functions and variables, and retain the existing browser-global module pattern (`CrosswordEngine`, `CrosswordProgress`). No formatter or linter is configured.

Name puzzle pairs with a descriptive lowercase slug and date, such as `final-assessment-2026-04-12`. Keep puzzle IDs unique and stable because they identify saved progress.

## Testing Guidelines

No automated framework or coverage threshold is configured. Validate changes in the browser: open the index and puzzle, enter letters, exercise arrow navigation and Tab direction switching, expand hints, check known letters, and reload to confirm progress persists. Confirm screenshots load and the console has no errors.

For puzzle data, verify equal-width grid rows, clue counts matching extracted slots, across clues in row-major order, down clues in column-major order, and manifest `whiteCellCount` matching the number of `.` cells. Supply complete answers or empty strings.

## Commit & Pull Request Guidelines

This checkout has no Git metadata, so historical commit conventions cannot be verified. Use concise, imperative subjects such as `Fix progress totals on puzzle index`.

Pull requests should explain the change, identify affected puzzles, and describe validation performed. Link relevant issues and include screenshots for visual changes. Update documentation when changing data contracts or setup.
