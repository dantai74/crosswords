(function (global) {
  const Eng = global.CrosswordEngine;
  const Prog = global.CrosswordProgress;

  function mountPuzzle(rootEl) {
    const data = global.PUZZLE_DATA;
    const { across, down } = Eng.validatePuzzle(data);

    const rows = data.rows;
    const H = rows.length;
    const W = rows[0].length;
    const acrossPub = data.across.map((e) => e.pub);
    const downPub = data.down.map((e) => e.pub);
    const cellMap = Eng.buildCellMap(rows, across, down);
    const labels = Eng.buildLabels(rows, across, down, acrossPub, downPub, cellMap);
    const answersAcross = data.across.map((e) => (e.answer || "").toUpperCase());
    const answersDown = data.down.map((e) => (e.answer || "").toUpperCase());

    let dir = "across";
    let ar = 0;
    let ac = 0;
    const inputs = {};
    const cellLetters = {};
    let userCells = {};
    const undoHistory = [];
    let viewReady = false;
    let wasCompleted = false;
    let renderedWord = "";
    let highlightedCells = [];
    const touchLayout = global.matchMedia?.("(max-width: 760px) and (pointer: coarse), (max-height: 520px) and (pointer: coarse)");
    let touchMode = Boolean(touchLayout?.matches);
    const progressLabel = document.createElement("p");
    progressLabel.className = "puzzle-progress";
    const saveStatus = document.createElement("p");
    saveStatus.className = "save-status muted";
    saveStatus.setAttribute("role", "status");

    const totalWhite = Prog.countWhiteCells(rows);
    const saved = Prog.loadProgress(data.id, rows, data.progressRevision);
    if (saved && saved.cells) userCells = { ...saved.cells };
    wasCompleted = saved?.filled === totalWhite && saved?.correctCount === totalWhite && saved?.checkable === totalWhite;
    const savedView = Prog.loadView(data.id, rows, data.progressRevision);

    function saveView() {
      if (!viewReady) return;
      Prog.saveView(data.id, { r: ar, c: ac, dir,
        zoomed: gridWrap.classList.contains("zoomed"),
        scrollLeft: gridWrap.scrollLeft, scrollTop: gridWrap.scrollTop }, data.progressRevision);
    }

    function rememberEdit() {
      undoHistory.push({ cells: { ...userCells }, r: ar, c: ac, dir });
      if (undoHistory.length > 100) undoHistory.shift();
      undoButton.disabled = false;
    }

    function undoEdit() {
      const previous = undoHistory.pop();
      if (!previous) return;
      userCells = previous.cells;
      for (const [key, input] of Object.entries(inputs)) {
        input.value = userCells[key] || "";
        cellLetters[key].textContent = input.value;
        input.classList.remove("wrong");
      }
      dir = previous.dir;
      focusCell(previous.r, previous.c);
      undoButton.disabled = !undoHistory.length;
      persist();
    }

    function persist() {
      const filled = Prog.countFilledCells(userCells, rows);
      progressLabel.textContent = `${filled} / ${totalWhite} letters filled`;
      const cc = Eng.countCorrectCells(
        rows,
        cellMap,
        userCells,
        across,
        down,
        answersAcross,
        answersDown
      );
      const completed = filled === totalWhite && cc.checkable === totalWhite && cc.correct === totalWhite;
      completion.hidden = filled !== totalWhite;
      completion.className = completed ? "completion-message solved" : "completion-message";
      completionText.textContent = completed ? "✓ Puzzle complete! Every answer is correct." :
        cc.checkable === totalWhite ? "The grid is full. Some letters need another look—use Check when you’re ready." :
        "The grid is full. This puzzle has a partial answer key, so completion cannot be verified yet.";
      completion.setAttribute("data-celebrate", String(completed && !wasCompleted));
      wasCompleted = completed;
      const savedOk = Prog.saveProgress(data.id, {
        cells: userCells,
        filled,
        total: totalWhite,
        correctCount: cc.correct,
        checkable: cc.checkable,
      }, data.progressRevision);
      saveStatus.textContent = savedOk ? "" :
        "Progress could not be saved. You can keep solving, but changes may be lost when you leave.";
      global.dispatchEvent(
        new CustomEvent("crossword-progress", { detail: { id: data.id } })
      );
    }

    function firstCellOfWord(wordIdx, d) {
      if (d === "across") {
        const w = across[wordIdx];
        return { r: w.r, c: w.c };
      }
      const w = down[wordIdx];
      return { r: w.r, c: w.c };
    }

    function moveDelta(dr, dc) {
      let r = ar + dr;
      let c = ac + dc;
      while (r >= 0 && r < H && c >= 0 && c < W) {
        if (Eng.isWhite(rows, r, c)) {
          focusCell(r, c);
          return;
        }
        r += dr;
        c += dc;
      }
    }

    function focusCell(r, c) {
      if (!Eng.isWhite(rows, r, c)) return;
      const previous = inputs[`${ar},${ac}`];
      if (previous) previous.tabIndex = -1;
      ar = r;
      ac = c;
      const inp = inputs[`${r},${c}`];
      if (inp) {
        inp.tabIndex = 0;
        inp.focus({ preventScroll: touchMode });
        if (!touchMode) inp.select();
      }
      updateChrome();
      if (touchMode) {
        revealWithin(gridWrap, inp.parentElement);
        const cell = inp.parentElement.getBoundingClientRect();
        const top = hintBox.getBoundingClientRect().bottom + 8;
        const bottom = keyboard.getBoundingClientRect().top - 8;
        if (bottom > top) {
          if (cell.bottom > bottom) global.scrollBy?.({ top: cell.bottom - bottom, behavior: "auto" });
          else if (cell.top < top) global.scrollBy?.({ top: cell.top - top, behavior: "auto" });
        }
      }
    }

    function writeCell(r, c, value) {
      const key = `${r},${c}`;
      const letter = value.replace(/[^A-Za-z0-9]/g, "").slice(-1).toUpperCase();
      if ((userCells[key] || "") !== letter) rememberEdit();
      inputs[key].value = letter;
      cellLetters[key].textContent = letter;
      inputs[key].classList.remove("wrong");
      if (letter) userCells[key] = letter;
      else delete userCells[key];
      persist();
      if (letter) advanceFrom(r, c, dir, false);
      saveView();
    }

    function eraseLetter() {
      const current = inputs[`${ar},${ac}`];
      if (current.value) {
        writeCell(ar, ac, "");
        return;
      }
      const dr = dir === "down" ? -1 : 0;
      const dc = dir === "across" ? -1 : 0;
      let r = ar + dr;
      let c = ac + dc;
      while (r >= 0 && r < H && c >= 0 && c < W) {
        if (Eng.isWhite(rows, r, c)) {
          focusCell(r, c);
          writeCell(r, c, "");
          return;
        }
        r += dr;
        c += dc;
      }
    }

    function moveWord(step) {
      const entries = dir === "across" ? data.across : data.down;
      if (!entries.length) return;
      const m = cellMap[ar][ac];
      const current = dir === "across" ? m.ai : m.di;
      const order = entries.map((entry, index) => ({ number: entry.pub, index }))
        .sort((a, b) => a.number - b.number);
      const position = order.findIndex((entry) => entry.index === current);
      selectWord(dir, order[(position + step + order.length) % order.length].index);
    }

    function revealWithin(container, element) {
      if (!container.clientWidth) return;
      const bounds = container.getBoundingClientRect();
      const cell = element.getBoundingClientRect();
      const left = bounds.left + container.clientLeft;
      const top = bounds.top + container.clientTop;
      if (cell.left < left) container.scrollLeft += cell.left - left;
      else if (cell.right > left + container.clientWidth) container.scrollLeft += cell.right - left - container.clientWidth;
      if (cell.top < top) container.scrollTop += cell.top - top;
      else if (cell.bottom > top + container.clientHeight) container.scrollTop += cell.bottom - top - container.clientHeight;
    }

    function advanceFrom(r, c, d, back) {
      const step = back ? -1 : 1;
      if (d === "across") {
        let nc = c + step;
        while (nc >= 0 && nc < W && Eng.isWhite(rows, r, nc)) {
          if (back || nc !== c) {
            focusCell(r, nc);
            return;
          }
          nc += step;
        }
      } else {
        let nr = r + step;
        while (nr >= 0 && nr < H && Eng.isWhite(rows, nr, c)) {
          if (back || nr !== r) {
            focusCell(nr, c);
            return;
          }
          nr += step;
        }
      }
    }

    function setDirPrefer(d) {
      const m = cellMap[ar][ac];
      if (d === "across" && m.ai >= 0) dir = "across";
      else if (d === "down" && m.di >= 0) dir = "down";
      else if (m.ai >= 0) dir = "across";
      else dir = "down";
    }

    function toggleDirection() {
      setDirPrefer(dir === "across" ? "down" : "across");
      updateChrome();
    }

    rootEl.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "puzzle-shell";

    const header = document.createElement("header");
    header.className = "puzzle-header";
    header.innerHTML = `<div><p class="eyebrow">Crossword</p><h1>${escapeHtml(data.title)}</h1><p class="byline">${escapeHtml(
      data.author || ""
    )}</p></div>`;
    header.appendChild(progressLabel);
    wrap.appendChild(header);

    let sourceReference;
    if (data.sourceScreenshot) {
      sourceReference = document.createElement("details");
      sourceReference.className = "source-reference";
      const summary = document.createElement("summary");
      summary.textContent = "View original puzzle";
      sourceReference.appendChild(summary);
      const fig = document.createElement("figure");
      fig.className = "source-shot";
      const img = document.createElement("img");
      img.src = data.sourceScreenshot;
      img.loading = "lazy";
      img.alt = "Original puzzle screenshot";
      fig.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.textContent = `Original printed puzzle · ${data.title}${data.author ? " by " + data.author : ""}`;
      fig.appendChild(cap);
      sourceReference.appendChild(fig);
    }

    const main = document.createElement("div");
    main.className = "puzzle-main";

    const gridWrap = document.createElement("div");
    gridWrap.className = "grid-wrap";
    const table = document.createElement("table");
    table.className = "cross-grid";
    table.setAttribute("role", "grid");
    table.setAttribute("aria-label", "Crossword puzzle");
    table.style.setProperty("--grid-columns", String(W));
    table.style.setProperty("--grid-rows", String(H));

    for (let r = 0; r < H; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < W; c++) {
        const td = document.createElement("td");
        if (!Eng.isWhite(rows, r, c)) {
          td.className = "cell black";
          tr.appendChild(td);
          continue;
        }
        td.className = "cell white";
        td.addEventListener("dblclick", (ev) => {
          ev.preventDefault();
          focusCell(r, c);
          toggleDirection();
        });
        const lab = labels[r][c];
        if (lab) {
          const num = document.createElement("span");
          num.className = "cell-num";
          num.textContent = lab;
          td.appendChild(num);
        }
        const inp = document.createElement("input");
        inp.type = "text";
        inp.maxLength = 1;
        inp.tabIndex = -1;
        inp.className = "cell-input";
        inp.dataset.r = String(r);
        inp.dataset.c = String(c);
        inp.setAttribute("aria-label", `Row ${r + 1} column ${c + 1}`);
        inp.setAttribute("aria-describedby", "hint-basic grid-help");
        inp.autocomplete = "off";
        inp.setAttribute("autocapitalize", "characters");
        inp.setAttribute("autocorrect", "off");
        inp.spellcheck = false;
        inp.readOnly = touchMode;
        inp.inputMode = touchMode ? "none" : "text";
        const key = `${r},${c}`;
        inputs[key] = inp;
        inp.value = (userCells[key] || "").toUpperCase();
        inp.addEventListener("input", () => {
          writeCell(r, c, inp.value);
        });
        inp.addEventListener("keydown", (ev) => {
          if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === "z") {
            ev.preventDefault();
            undoEdit();
            return;
          }
          if (touchMode && /^[a-z0-9]$/i.test(ev.key) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
            ev.preventDefault();
            writeCell(r, c, ev.key);
            return;
          }
          if (ev.key === "Backspace") {
            ev.preventDefault();
            eraseLetter();
            return;
          }
          if (ev.key === "ArrowRight") {
            ev.preventDefault();
            moveDelta(0, 1);
            return;
          }
          if (ev.key === "ArrowLeft") {
            ev.preventDefault();
            moveDelta(0, -1);
            return;
          }
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            moveDelta(1, 0);
            return;
          }
          if (ev.key === "ArrowUp") {
            ev.preventDefault();
            moveDelta(-1, 0);
            return;
          }
          if (ev.key === " ") {
            ev.preventDefault();
            toggleDirection();
            return;
          }
        });
        inp.addEventListener("focus", () => {
          const previous = inputs[`${ar},${ac}`];
          if (previous) previous.tabIndex = -1;
          inp.tabIndex = 0;
          ar = r;
          ac = c;
          setDirPrefer(dir);
          updateChrome();
        });
        inp.addEventListener("click", () => { if (!touchMode) inp.select(); });
        inp.addEventListener("pointerdown", () => {
          if (touchMode) setKeyboardCollapsed(false);
        });
        const displayedLetter = document.createElement("span");
        displayedLetter.className = "cell-letter";
        displayedLetter.setAttribute("aria-hidden", "true");
        displayedLetter.textContent = inp.value;
        cellLetters[key] = displayedLetter;
        td.append(inp, displayedLetter);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    gridWrap.appendChild(table);

    const gridTools = document.createElement("div");
    gridTools.className = "grid-tools";
    const zoomButton = document.createElement("button");
    zoomButton.type = "button";
    zoomButton.textContent = "Zoom grid";
    zoomButton.setAttribute("aria-pressed", "false");
    zoomButton.addEventListener("click", () => {
      const zoomed = !gridWrap.classList.contains("zoomed");
      if (zoomed) gridWrap.classList.add("zoomed");
      else gridWrap.classList.remove("zoomed");
      zoomButton.textContent = zoomed ? "Fit grid" : "Zoom grid";
      zoomButton.setAttribute("aria-pressed", String(zoomed));
      saveView();
      revealWithin(gridWrap, inputs[`${ar},${ac}`].parentElement);
    });
    const acrossCluesButton = document.createElement("button");
    acrossCluesButton.type = "button";
    acrossCluesButton.textContent = "All across clues ↓";
    acrossCluesButton.addEventListener("click", () => cluesAc.scrollIntoView({ block: "start" }));
    const downCluesButton = document.createElement("button");
    downCluesButton.type = "button";
    downCluesButton.textContent = "All down clues ↓";
    downCluesButton.addEventListener("click", () => cluesDn.scrollIntoView({ block: "start" }));
    const cluesButton = document.createElement("button");
    cluesButton.type = "button";
    cluesButton.className = "open-clues";
    cluesButton.textContent = "Clues";
    cluesButton.setAttribute("aria-haspopup", "dialog");
    cluesButton.addEventListener("click", () => {
      showClueTab(dir);
      cluesDialog.showModal();
      const m = cellMap[ar][ac];
      const selected = cluePanels.querySelector(`.clue-btn[data-dir="${dir}"][data-idx="${dir === "across" ? m.ai : m.di}"]`);
      if (selected) { selected.focus(); showClue(selected); }
    });
    gridTools.append(zoomButton, cluesButton, acrossCluesButton, downCluesButton);
    gridWrap.addEventListener("scroll", saveView);

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const keyboardHelp = document.createElement("p");
    keyboardHelp.className = "muted";
    keyboardHelp.id = "grid-help";
    keyboardHelp.textContent = "Double-click a square or press Space to switch direction. Arrow keys move; Tab leaves the grid.";
    table.setAttribute("aria-describedby", "grid-help");
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "primary-button";
    checkBtn.setAttribute("aria-label", "Check known letters");
    checkBtn.textContent = "Check known letters";
    checkBtn.title = "Mark incorrect filled letters in red. Empty cells are left unchanged.";
    checkBtn.addEventListener("click", () => {
      let any = false;
      for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
          if (!Eng.isWhite(rows, r, c)) continue;
          const exp = Eng.letterFromAnswerAt(
            cellMap,
            across,
            down,
            answersAcross,
            answersDown,
            r,
            c
          );
          const inp = inputs[`${r},${c}`];
          if (!exp || !inp) {
            inp && inp.classList.remove("wrong");
            continue;
          }
          any = true;
          const got = (inp.value || "").toUpperCase();
          if (got && got !== exp) inp.classList.add("wrong");
          else inp.classList.remove("wrong");
        }
      }
      if (!any) alert("No answer letters are filled in the data file yet for checking.");
      persist();
    });
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.setAttribute("aria-label", "Clear progress");
    clearBtn.title = "Clear all entered letters for this puzzle";
    clearBtn.textContent = "Clear progress";
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all letters you entered for this puzzle?")) return;
      if (Object.keys(userCells).length) rememberEdit();
      userCells = {};
      for (const k of Object.keys(inputs)) {
        inputs[k].value = "";
        cellLetters[k].textContent = "";
        inputs[k].classList.remove("wrong");
      }
      Prog.clearProgress(data.id, data.progressRevision);
      persist();
    });
    for (const button of [checkBtn, clearBtn]) {
      button.addEventListener("pointerdown", (ev) => {
        if (touchMode) ev.preventDefault();
      });
    }
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "undo-button";
    undoButton.textContent = "↶ Undo";
    undoButton.setAttribute("aria-label", "Undo last edit");
    undoButton.title = "Undo last edit (Ctrl/Command Z)";
    undoButton.disabled = true;
    undoButton.addEventListener("pointerdown", (ev) => ev.preventDefault());
    undoButton.addEventListener("click", undoEdit);
    toolbar.appendChild(undoButton);
    toolbar.appendChild(checkBtn);
    toolbar.appendChild(clearBtn);
    toolbar.appendChild(keyboardHelp);
    toolbar.appendChild(saveStatus);

    const hintBox = document.createElement("section");
    hintBox.className = "hint-box";
    hintBox.setAttribute("aria-label", `Active clue for ${data.title}`);
    hintBox.innerHTML = "<h2>Active clue</h2>";
    const directions = document.createElement("div");
    directions.className = "direction-switch";
    directions.setAttribute("role", "group");
    directions.setAttribute("aria-label", "Word direction");
    const directionButtons = {};
    for (const d of ["across", "down"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = d === "across" ? "Across →" : "Down ↓";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        setDirPrefer(d);
        focusCell(ar, ac);
      });
      directionButtons[d] = button;
      directions.appendChild(button);
    }
    const navigation = document.createElement("div");
    navigation.className = "clue-navigation";
    const previousClue = document.createElement("button");
    previousClue.type = "button";
    previousClue.className = "word-nav";
    previousClue.textContent = "‹";
    previousClue.setAttribute("aria-label", "Previous clue");
    previousClue.addEventListener("click", () => moveWord(-1));
    const nextClue = document.createElement("button");
    nextClue.type = "button";
    nextClue.className = "word-nav";
    nextClue.textContent = "›";
    nextClue.setAttribute("aria-label", "Next clue");
    nextClue.addEventListener("click", () => moveWord(1));
    navigation.append(previousClue, directions, nextClue);
    hintBox.appendChild(navigation);
    const hb = document.createElement("div");
    hb.id = "hint-basic";
    const he = document.createElement("div");
    he.id = "hint-ext";
    const lookupHelp = document.createElement("p");
    lookupHelp.className = "lookup-help muted";
    lookupHelp.textContent = "Click any clue word to look up its meaning on Google.";
    const hintExtras = document.createElement("details");
    hintExtras.className = "hint-extras";
    hintExtras.open = true;
    const hintSummary = document.createElement("summary");
    hintSummary.textContent = "Hints & answer";
    hintExtras.append(hintSummary, lookupHelp, he);
    const completion = document.createElement("section");
    completion.className = "completion-message";
    completion.hidden = true;
    completion.setAttribute("role", "status");
    const completionText = document.createElement("p");
    const nextPuzzle = document.createElement("a");
    nextPuzzle.setAttribute("href", "../index.html");
    nextPuzzle.textContent = "Choose another puzzle →";
    completion.append(completionText, nextPuzzle);
    hintBox.append(hb, completion, hintExtras);

    const cluePanels = document.createElement("div");
    cluePanels.className = "clue-panels";

    const cluesAc = document.createElement("section");
    cluesAc.className = "clues";
    cluesAc.innerHTML = "<h2>Across</h2><p class=\"clue-help\">Number selects a clue · Words open Google</p><ol class=\"clue-list\"></ol>";
    const cluesDn = document.createElement("section");
    cluesDn.className = "clues";
    cluesDn.innerHTML = "<h2>Down</h2><p class=\"clue-help\">Number selects a clue · Words open Google</p><ol class=\"clue-list\"></ol>";

    const listA = cluesAc.querySelector(".clue-list");
    const listD = cluesDn.querySelector(".clue-list");

    function selectWord(d, idx) {
      if (cluesDialog.open) cluesDialog.close();
      dir = d;
      const p = firstCellOfWord(idx, d);
      focusCell(p.r, p.c);
    }

    function addClues(entries, list, direction) {
      entries.map((entry, i) => ({ entry, i }))
        .sort((a, b) => a.entry.pub - b.entry.pub)
        .forEach(({ entry, i }) => {
          const li = document.createElement("li");
          li.className = "clue-row";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "clue-btn";
          button.setAttribute("data-dir", direction);
          button.setAttribute("data-idx", String(i));
          button.setAttribute("aria-label", `Select ${direction === "across" ? "Across" : "Down"} ${entry.pub}: ${entry.clue}`);
          const number = document.createElement("span");
          number.className = "n";
          number.textContent = String(entry.pub);
          button.appendChild(number);
          const text = document.createElement("span");
          text.className = "clue-text";
          appendClueWords(text, entry.clue);
          li.append(button, text);
          list.appendChild(li);
        });
    }
    addClues(data.across, listA, "across");
    addClues(data.down, listD, "down");

    cluePanels.addEventListener("click", (ev) => {
      if (ev.target.closest("a")) return;
      const row = ev.target.closest(".clue-row");
      const btn = row && row.querySelector(".clue-btn");
      if (!btn) return;
      const d = btn.getAttribute("data-dir");
      const idx = Number(btn.getAttribute("data-idx"));
      selectWord(d === "across" ? "across" : "down", idx);
    });

    const gridPanel = document.createElement("section");
    gridPanel.className = "grid-panel";
    gridPanel.setAttribute("aria-label", "Puzzle grid and controls");
    gridPanel.append(gridTools, gridWrap, toolbar);
    main.append(gridPanel, hintBox, cluePanels);
    cluePanels.append(cluesAc, cluesDn);

    const cluesDialog = document.createElement("dialog");
    cluesDialog.className = "clues-dialog";
    cluesDialog.setAttribute("aria-label", "All clues");
    const sheetControls = document.createElement("div");
    sheetControls.className = "clues-sheet-controls";
    const clueTabs = {};
    function showClueTab(direction) {
      for (const d of ["across", "down"]) {
        clueTabs[d].setAttribute("aria-pressed", String(d === direction));
      }
      cluesAc.hidden = direction !== "across";
      cluesDn.hidden = direction !== "down";
    }
    for (const direction of ["across", "down"]) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = direction === "across" ? "Across" : "Down";
      tab.addEventListener("click", () => showClueTab(direction));
      clueTabs[direction] = tab;
      sheetControls.appendChild(tab);
    }
    const closeClues = document.createElement("button");
    closeClues.type = "button";
    closeClues.className = "close-clues";
    closeClues.textContent = "✕";
    closeClues.setAttribute("aria-label", "Close clues");
    closeClues.addEventListener("click", () => { cluesDialog.close(); cluesButton.focus(); });
    sheetControls.appendChild(closeClues);
    cluesDialog.appendChild(sheetControls);
    cluesDialog.addEventListener("click", (ev) => { if (ev.target === cluesDialog) cluesDialog.close(); });
    wrap.append(main, cluesDialog);
    const libraryLink = document.createElement("a");
    libraryLink.className = "puzzle-library-link";
    libraryLink.setAttribute("href", "../index.html");
    libraryLink.textContent = "← All puzzles";
    wrap.appendChild(libraryLink);
    const keyboard = document.createElement("section");
    keyboard.className = "touch-keyboard";
    keyboard.setAttribute("aria-label", "Crossword keyboard");
    const keyboardTop = document.createElement("div");
    keyboardTop.className = "keyboard-top";
    const keyboardNavigation = document.createElement("div");
    keyboardNavigation.className = "keyboard-navigation";
    keyboardNavigation.setAttribute("role", "group");
    keyboardNavigation.setAttribute("aria-label", "Clue navigation");
    for (const [key, label, step] of [["Previous", "<", -1], ["Next", ">", 1]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "keyboard-nav";
      button.textContent = label;
      button.setAttribute("data-key", key);
      button.setAttribute("aria-label", key + " clue");
      button.addEventListener("pointerdown", (ev) => ev.preventDefault());
      button.addEventListener("click", () => moveWord(step));
      keyboardNavigation.appendChild(button);
    }
    const keyboardDirection = document.createElement("button");
    keyboardDirection.type = "button";
    keyboardDirection.className = "keyboard-direction";
    keyboardDirection.addEventListener("pointerdown", (ev) => ev.preventDefault());
    keyboardDirection.addEventListener("click", () => {
      toggleDirection();
      focusCell(ar, ac);
    });
    const keyboardToggle = document.createElement("button");
    keyboardToggle.type = "button";
    keyboardToggle.className = "keyboard-toggle";
    keyboardToggle.addEventListener("click", () => setKeyboardCollapsed(!keyboard.classList.contains("collapsed")));
    keyboardTop.append(keyboardNavigation, keyboardDirection, keyboardToggle);
    const keyboardRows = document.createElement("div");
    keyboardRows.className = "keyboard-rows";
    for (const letters of ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]) {
      const row = document.createElement("div");
      row.className = "keyboard-row";
      const keys = [...letters];
      if (letters === "ZXCVBNM") {
        const digits = [...new Set([...data.across, ...data.down]
          .flatMap((entry) => (entry.answer || "").match(/[0-9]/g) || []))].sort();
        keys.push(...digits, "Backspace");
      }
      for (const letter of keys) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "keyboard-key" + (letter.length > 1 ? " keyboard-action" : "");
        button.setAttribute("data-key", letter);
        button.textContent = letter === "Backspace" ? "⌫" : letter;
        button.setAttribute("aria-label", letter === "Backspace" ? "Delete letter" : letter);
        button.addEventListener("pointerdown", (ev) => ev.preventDefault());
        button.addEventListener("click", () => {
          focusCell(ar, ac);
          if (letter === "Backspace") eraseLetter();
          else writeCell(ar, ac, letter);
        });
        row.appendChild(button);
      }
      keyboardRows.appendChild(row);
    }
    keyboard.append(keyboardTop, keyboardRows);
    wrap.appendChild(keyboard);
    if (sourceReference) wrap.appendChild(sourceReference);
    rootEl.appendChild(wrap);

    function setKeyboardCollapsed(collapsed) {
      if (collapsed) {
        keyboard.classList.add("collapsed");
        wrap.classList.add("keyboard-collapsed");
      } else {
        keyboard.classList.remove("collapsed");
        wrap.classList.remove("keyboard-collapsed");
      }
      keyboardToggle.textContent = collapsed ? "⌨" : "⌄";
      keyboardToggle.setAttribute("aria-label", collapsed ? "Show keyboard" : "Hide keyboard");
      keyboardToggle.title = collapsed ? "Show keyboard" : "Hide keyboard";
      keyboardToggle.setAttribute("aria-expanded", String(!collapsed));
    }

    function applyTouchLayout() {
      touchMode = Boolean(touchLayout?.matches);
      if (touchMode) wrap.classList.add("touch-mode");
      else wrap.classList.remove("touch-mode");
      if (cluesDialog.open) cluesDialog.close();
      cluesAc.hidden = false;
      cluesDn.hidden = false;
      if (touchMode) {
        cluesDialog.appendChild(cluePanels);
        showClueTab(dir);
      } else main.appendChild(cluePanels);
      cluesButton.hidden = !touchMode;
      acrossCluesButton.hidden = touchMode;
      downCluesButton.hidden = touchMode;
      keyboard.hidden = !touchMode;
      navigation.hidden = touchMode;
      header.hidden = touchMode;
      const pageNavigation = document.querySelector?.(".puzzle-nav");
      if (pageNavigation) pageNavigation.hidden = touchMode;
      if (touchMode) {
        checkBtn.className = "keyboard-check";
        clearBtn.className = "keyboard-clear";
        checkBtn.textContent = "✓";
        clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"></path></svg>';
        keyboardTop.append(checkBtn, clearBtn, keyboardToggle);
        undoButton.className = "keyboard-undo keyboard-action";
        keyboardRows.children[keyboardRows.children.length - 1].appendChild(undoButton);
      } else {
        checkBtn.className = "primary-button";
        clearBtn.className = "";
        checkBtn.textContent = "Check known letters";
        clearBtn.textContent = "Clear progress";
        undoButton.className = "undo-button";
        toolbar.append(undoButton, checkBtn, clearBtn, keyboardHelp, saveStatus);
      }
      hintExtras.open = !touchMode;
      if (touchMode && hb.querySelector(".clue-meta")) hb.querySelector(".clue-meta").appendChild(progressLabel);
      else header.appendChild(progressLabel);
      keyboardHelp.textContent = touchMode
        ? "Tap a square in the grid, then use the crossword keyboard. Use Across or Down to switch direction."
        : "Double-click a square or press Space to switch direction. Arrow keys move; Tab leaves the grid.";
      for (const input of Object.values(inputs)) {
        input.readOnly = touchMode;
        input.inputMode = touchMode ? "none" : "text";
      }
      setKeyboardCollapsed(false);
    }
    applyTouchLayout();
    touchLayout?.addEventListener?.("change", applyTouchLayout);

    function currentEntries() {
      const m = cellMap[ar][ac];
      const out = [];
      if (dir === "across" && m.ai >= 0) out.push({ type: "across", idx: m.ai });
      else if (dir === "down" && m.di >= 0) out.push({ type: "down", idx: m.di });
      if (!out.length) {
        if (m.ai >= 0) out.push({ type: "across", idx: m.ai });
        if (m.di >= 0) out.push({ type: "down", idx: m.di });
      }
      return out;
    }

    function showClue(button) {
      const row = button.parentElement;
      const list = row.parentElement;
      if (!list.clientHeight) return;
      const bounds = list.getBoundingClientRect();
      const clue = row.getBoundingClientRect();
      const top = bounds.top + list.clientTop;
      const bottom = top + list.clientHeight;
      if (clue.top < top || clue.height > list.clientHeight) {
        list.scrollTop += clue.top - top;
      } else if (clue.bottom > bottom) {
        list.scrollTop += clue.bottom - bottom;
      }
    }

    function updateChrome() {
      saveView();
      const entries = currentEntries();
      const wordKey = entries.map((e) => `${e.type}:${e.idx}`).join(",");
      for (const d of ["across", "down"]) {
        directionButtons[d].setAttribute("aria-pressed", String(d === dir));
        const m = cellMap[ar][ac];
        directionButtons[d].disabled = (d === "across" ? m.ai : m.di) < 0;
      }
      keyboardDirection.textContent = dir === "across" ? "Across →" : "Down ↓";
      keyboardDirection.setAttribute("aria-label", `Direction: ${dir}. Switch to ${dir === "across" ? "down" : "across"}`);
      const cell = cellMap[ar][ac];
      keyboardDirection.disabled = cell.ai < 0 || cell.di < 0;
      if (wordKey === renderedWord) return;
      renderedWord = wordKey;
      for (const input of highlightedCells) input.parentElement.classList.remove("word-active");
      highlightedCells = [];
      cluePanels.querySelectorAll(".clue-btn").forEach((button) => {
        button.classList.remove("active");
        button.parentElement.classList.remove("active");
        button.removeAttribute("aria-current");
      });
      hb.innerHTML = "";
      he.innerHTML = "";

      if (!entries.length) return;

      entries.forEach((e) => {
        const arr = e.type === "across" ? data.across : data.down;
        const entry = arr[e.idx];
        const clueBtn = cluePanels.querySelector(
          `.clue-btn[data-dir="${e.type === "across" ? "across" : "down"}"][data-idx="${e.idx}"]`
        );
        if (clueBtn) {
          clueBtn.classList.add("active");
          clueBtn.parentElement.classList.add("active");
          clueBtn.setAttribute("aria-current", "true");
          showClue(clueBtn);
        }

        const h3 = document.createElement("h3");
        const word = (e.type === "across" ? across : down)[e.idx];
        for (let k = 0; k < word.len; k++) {
          const r = word.r + (e.type === "down" ? k : 0);
          const c = word.c + (e.type === "across" ? k : 0);
          const input = inputs[`${r},${c}`];
          input.parentElement.classList.add("word-active");
          highlightedCells.push(input);
        }
        h3.textContent = `${e.type === "across" ? "Across" : "Down"} ${entry.pub} (${word.len} letters)`;
        const meta = document.createElement("div");
        meta.className = "clue-meta";
        meta.appendChild(h3);
        if (touchMode) meta.appendChild(progressLabel);
        hb.appendChild(meta);
        const p = document.createElement("p");
        p.className = "basic-clue";
        appendClueWords(p, entry.clue);
        hb.appendChild(p);

        const hints = entry.hints || [];
        if (!hints.length) {
          const em = document.createElement("p");
          em.className = "muted";
          em.textContent = "No extended hints for this entry yet.";
          he.appendChild(em);
        }
        hints.forEach((text, hi) => {
          const det = document.createElement("details");
          det.className = "ext-hint";
          const sm = document.createElement("summary");
          sm.textContent = ["Gentle hint", "More specific hint", "Strong hint"][hi] || `Hint ${hi + 1}`;
          const pp = document.createElement("p");
          pp.textContent = text;
          det.appendChild(sm);
          det.appendChild(pp);
          he.appendChild(det);
        });
        if (entry.answer) {
          const reveal = document.createElement("details");
          reveal.className = "ext-hint answer-reveal";
          const summary = document.createElement("summary");
          summary.textContent = "Reveal answer (spoiler)";
          const answer = document.createElement("p");
          answer.textContent = entry.answer;
          reveal.append(summary, answer);
          if (entry.answerExplanation) {
            const explanation = document.createElement("p");
            explanation.className = "answer-explanation";
            explanation.textContent = entry.answerExplanation;
            reveal.appendChild(explanation);
          }
          he.appendChild(reveal);
        }
      });
    }

    const firstRow = rows.findIndex((row) => row.includes("."));
    if (savedView?.zoomed) {
      gridWrap.classList.add("zoomed");
      zoomButton.textContent = "Fit grid";
      zoomButton.setAttribute("aria-pressed", "true");
    }
    dir = savedView?.dir || "across";
    focusCell(savedView?.r ?? firstRow, savedView?.c ?? rows[firstRow].indexOf("."));
    if (savedView) {
      const restoreScroll = () => {
        gridWrap.scrollLeft = savedView.scrollLeft;
        gridWrap.scrollTop = savedView.scrollTop;
      };
      restoreScroll();
      global.requestAnimationFrame?.(restoreScroll);
    }
    viewReady = true;
    persist();
  }

  function appendClueWords(paragraph, clue) {
    const words = /\p{L}[\p{L}\p{M}]*(?:['’\u2010\u2011-]\p{L}[\p{L}\p{M}]*)*/gu;
    let position = 0;
    for (const match of clue.matchAll(words)) {
      paragraph.appendChild(document.createTextNode(clue.slice(position, match.index)));
      const word = match[0];
      const link = document.createElement("a");
      link.className = "clue-word";
      link.textContent = word;
      link.setAttribute("href", "https://www.google.com/search?q=" + encodeURIComponent(word + " meaning"));
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("title", `Look up “${word}” on Google (opens in a new tab)`);
      link.setAttribute("aria-label", `Look up “${word}” on Google (opens in a new tab)`);
      paragraph.appendChild(link);
      position = match.index + word.length;
    }
    paragraph.appendChild(document.createTextNode(clue.slice(position)));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.mountCrosswordPuzzle = mountPuzzle;
})(typeof window !== "undefined" ? window : globalThis);
