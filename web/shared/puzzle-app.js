(function (global) {
  function validatePuzzle(data) {
    function requireValid(condition, message) {
      if (!condition) throw new Error("Invalid puzzle: " + message);
    }
    requireValid(data && typeof data === "object", "missing data");
    requireValid(typeof data.id === "string" && data.id.trim(), "missing id");
    requireValid(typeof data.title === "string" && data.title.trim(), "missing title");
    requireValid(Array.isArray(data.rows) && data.rows.length > 0, "grid is empty");
    const width = typeof data.rows[0] === "string" ? data.rows[0].length : 0;
    requireValid(width > 0 && data.rows.every((row) =>
      typeof row === "string" && row.length === width && /^[.#]+$/.test(row)
    ), "rows must have equal width and contain only . or #");
    requireValid(data.rows.some((row) => row.includes(".")), "grid has no white cells");
    const words = extractWords(data.rows);
    const labels = numberGrid(data.rows, words.across, words.down);
    requireValid(data.progressRevision === undefined ||
      (Number.isSafeInteger(data.progressRevision) && data.progressRevision > 0),
      "progressRevision must be a positive integer");
    for (const dir of ["across", "down"]) {
      requireValid(Array.isArray(data[dir]) && data[dir].length === words[dir].length,
        dir + " clue count does not match grid slots");
      data[dir].forEach((entry, i) => {
        requireValid(entry && Number.isSafeInteger(entry.pub) && entry.pub > 0 &&
          typeof entry.clue === "string", dir + " clue " + (i + 1) + " is malformed");
        const slot = words[dir][i];
        requireValid(entry.pub === labels[slot.r][slot.c],
          dir + " clue " + entry.pub + " does not match its numbered grid start");
        requireValid(entry.hints === undefined || (Array.isArray(entry.hints) &&
          entry.hints.every((hint) => typeof hint === "string" && hint.trim())),
          "hints must be non-empty strings");
        requireValid(entry.answerExplanation === undefined ||
          (typeof entry.answerExplanation === "string" && entry.answerExplanation.trim()),
          "answerExplanation must be a non-empty string");
        requireValid(entry.answer === undefined || entry.answer === "" ||
          (typeof entry.answer === "string" && /^[A-Za-z0-9]+$/.test(entry.answer) &&
            entry.answer.length === words[dir][i].len),
          dir + " " + entry.pub + " answer must match the slot length");
      });
    }
    const map = buildCellMap(data.rows, words.across, words.down);
    const aa = data.across.map((entry) => entry.answer || "");
    const ad = data.down.map((entry) => entry.answer || "");
    data.rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== ".") return;
      requireValid(map[r][c].ai >= 0 || map[r][c].di >= 0,
        "white cell has no word at row " + (r + 1) + " column " + (c + 1));
      requireValid(letterFromAnswerAt(map, words.across, words.down, aa, ad, r, c) !== null,
        "answers conflict at row " + (r + 1) + " column " + (c + 1));
    }));
    return words;
  }

  function isWhite(rows, r, c) {
    return rows[r] && rows[r][c] === ".";
  }

  function numberGrid(rows, across, down) {
    const starts = new Set([...across, ...down].map((word) => `${word.r},${word.c}`));
    let number = 0;
    return rows.map((row, r) => [...row].map((_, c) =>
      starts.has(`${r},${c}`) ? ++number : null
    ));
  }

  function acrossLen(rows, r, c) {
    const W = rows[r].length;
    let L = 0;
    while (c + L < W && isWhite(rows, r, c + L)) L++;
    return L;
  }

  function downLen(rows, r, c) {
    const H = rows.length;
    let L = 0;
    while (r + L < H && isWhite(rows, r + L, c)) L++;
    return L;
  }

  function extractWords(rows) {
    const H = rows.length;
    const W = rows[0].length;
    const across = [];
    const down = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isWhite(rows, r, c)) continue;
        if (c === 0 || !isWhite(rows, r, c - 1)) {
          const L = acrossLen(rows, r, c);
          if (L >= 2) across.push({ r, c, len: L });
        }
      }
    }
    for (let c = 0; c < W; c++) {
      for (let r = 0; r < H; r++) {
        if (!isWhite(rows, r, c)) continue;
        if (r === 0 || !isWhite(rows, r - 1, c)) {
          const L = downLen(rows, r, c);
          if (L >= 2) down.push({ r, c, len: L });
        }
      }
    }
    return { across, down };
  }

  function buildCellMap(rows, across, down) {
    const H = rows.length;
    const W = rows[0].length;
    const cells = [];
    for (let r = 0; r < H; r++) {
      cells[r] = [];
      for (let c = 0; c < W; c++) {
        if (!isWhite(rows, r, c)) {
          cells[r][c] = null;
          continue;
        }
        let ai = -1;
        let di = -1;
        for (let i = 0; i < across.length; i++) {
          const w = across[i];
          if (r === w.r && c >= w.c && c < w.c + w.len) {
            ai = i;
            break;
          }
        }
        for (let i = 0; i < down.length; i++) {
          const w = down[i];
          if (c === w.c && r >= w.r && r < w.r + w.len) {
            di = i;
            break;
          }
        }
        cells[r][c] = { ai, di };
      }
    }
    return cells;
  }

  function buildLabels(rows, across, down, acrossPub, downPub, cellMap) {
    const H = rows.length;
    const W = rows[0].length;
    const label = [];
    for (let r = 0; r < H; r++) {
      label[r] = [];
      for (let c = 0; c < W; c++) {
        if (!isWhite(rows, r, c)) {
          label[r][c] = null;
          continue;
        }
        const cell = cellMap[r][c];
        let aNum = null;
        let dNum = null;
        if (cell.ai >= 0 && across[cell.ai].r === r && across[cell.ai].c === c) {
          aNum = acrossPub[cell.ai];
        }
        if (cell.di >= 0 && down[cell.di].r === r && down[cell.di].c === c) {
          dNum = downPub[cell.di];
        }
        if (aNum != null && dNum != null) {
          label[r][c] = aNum === dNum ? String(aNum) : `${aNum}/${dNum}`;
        } else if (aNum != null) {
          label[r][c] = String(aNum);
        } else if (dNum != null) {
          label[r][c] = String(dNum);
        } else {
          label[r][c] = null;
        }
      }
    }
    return label;
  }

  function letterFromAnswerAt(cellMap, across, down, answersAcross, answersDown, r, c) {
    const cell = cellMap[r][c];
    if (!cell) return "";
    const chA =
      cell.ai >= 0
        ? (answersAcross[cell.ai] || "")[c - across[cell.ai].c] || ""
        : "";
    const chD =
      cell.di >= 0
        ? (answersDown[cell.di] || "")[r - down[cell.di].r] || ""
        : "";
    const uA = chA.toUpperCase();
    const uD = chD.toUpperCase();
    if (uA && uD && uA !== uD) return null;
    return uA || uD || "";
  }

  function countCorrectCells(rows, cellMap, userCells, across, down, answersAcross, answersDown) {
    let correct = 0;
    let checkable = 0;
    const H = rows.length;
    const W = rows[0].length;
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isWhite(rows, r, c)) continue;
        const expected = letterFromAnswerAt(
          cellMap,
          across,
          down,
          answersAcross,
          answersDown,
          r,
          c
        );
        if (!expected) continue;
        checkable++;
        const got = (userCells[`${r},${c}`] || "").toUpperCase();
        if (got === expected) correct++;
      }
    }
    return { correct, checkable };
  }

  global.CrosswordEngine = {
    validatePuzzle,
    numberGrid,
    isWhite,
    extractWords,
    buildCellMap,
    buildLabels,
    letterFromAnswerAt,
    countCorrectCells,
  };
})(typeof window !== "undefined" ? window : globalThis);
