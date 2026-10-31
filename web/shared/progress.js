(function (global) {
  const STORAGE_PREFIX = "crossword.v1.";

  function key(puzzleId, revision) {
    return STORAGE_PREFIX + "progress." + puzzleId + (revision ? ".r" + revision : "");
  }

  function sanitizeCells(cells, rows) {
    const clean = {};
    if (!cells || typeof cells !== "object" || Array.isArray(cells)) return clean;
    for (const [coordinate, letter] of Object.entries(cells)) {
      if (!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(coordinate)) continue;
      if (typeof letter !== "string" || !/^[A-Za-z0-9]$/.test(letter)) continue;
      const [r, c] = coordinate.split(",").map(Number);
      if (rows && rows[r]?.[c] !== ".") continue;
      clean[coordinate] = letter.toUpperCase();
    }
    return clean;
  }

  function loadProgress(puzzleId, rows, revision) {
    try {
      const raw = localStorage.getItem(key(puzzleId, revision));
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      const cells = sanitizeCells(saved.cells, rows);
      const clean = { cells, filled: Object.keys(cells).length };
      for (const field of ["total", "correctCount", "checkable", "updatedAt"]) {
        if (Number.isSafeInteger(saved[field]) && saved[field] >= 0) {
          clean[field] = saved[field];
        }
      }
      return clean;
    } catch {
      return null;
    }
  }

  function saveProgress(puzzleId, payload, revision) {
    try {
      localStorage.setItem(
        key(puzzleId, revision),
        JSON.stringify({ ...payload, updatedAt: Date.now() })
      );
      return true;
    } catch {
      return false;
    }
  }

  function clearProgress(puzzleId, revision) {
    try {
      localStorage.removeItem(key(puzzleId, revision));
      return true;
    } catch {
      return false;
    }
  }

  function countFilledCells(cells, rows) {
    let n = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== ".") continue;
        const ch = cells[`${r},${c}`];
        if (ch && /[A-Za-z0-9]/.test(ch)) n++;
      }
    }
    return n;
  }

  function countFilledKeys(cells) {
    return Object.values(cells || {}).filter(
      (ch) => ch && /[A-Za-z0-9]/.test(String(ch))
    ).length;
  }

  function countWhiteCells(rows) {
    let n = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === ".") n++;
      }
    }
    return n;
  }

  /**
   * @param {{ id: string, whiteCellCount?: number, progressRevision?: number }} meta
   */
  function statsForPuzzle(meta) {
    const saved = loadProgress(meta.id, undefined, meta.progressRevision);
    const total = meta.whiteCellCount ?? saved?.total ?? 0;
    const filled = saved?.cells
      ? saved.filled ?? countFilledKeys(saved.cells)
      : saved?.filled ?? 0;
    const percent = total ? Math.min(100, Math.round((filled / total) * 100)) : 0;
    return {
      filled,
      total,
      percent,
      correct: saved?.correctCount ?? null,
      checkable: saved?.checkable ?? null,
      updatedAt: saved?.updatedAt ?? null,
    };
  }

  global.CrosswordProgress = {
    loadProgress,
    sanitizeCells,
    saveProgress,
    clearProgress,
    countFilledCells,
    countWhiteCells,
    statsForPuzzle,
    key,
  };
})(typeof window !== "undefined" ? window : globalThis);
