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
    let userCells = {};
    let renderedWord = "";
    let highlightedCells = [];
    const progressLabel = document.createElement("p");
    progressLabel.className = "puzzle-progress";
    const saveStatus = document.createElement("p");
    saveStatus.className = "save-status muted";
    saveStatus.setAttribute("role", "status");

    const totalWhite = Prog.countWhiteCells(rows);
    const saved = Prog.loadProgress(data.id, rows, data.progressRevision);
    if (saved && saved.cells) userCells = { ...saved.cells };

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
        inp.focus();
        inp.select();
      }
      updateChrome();
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
        inp.spellcheck = false;
        const key = `${r},${c}`;
        inputs[key] = inp;
        inp.value = (userCells[key] || "").toUpperCase();
        inp.addEventListener("input", () => {
          let v = inp.value.replace(/[^A-Za-z]/g, "").slice(-1).toUpperCase();
          inp.value = v;
          if (v) userCells[key] = v;
          else delete userCells[key];
          inp.classList.remove("wrong");
          persist();
          if (v) advanceFrom(r, c, dir, false);
        });
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Backspace" && !inp.value) {
            ev.preventDefault();
            const step =
              dir === "across" ? { dr: 0, dc: -1 } : { dr: -1, dc: 0 };
            let pr = r + step.dr;
            let pc = c + step.dc;
            while (pr >= 0 && pr < H && pc >= 0 && pc < W) {
              if (Eng.isWhite(rows, pr, pc)) {
                const pk = `${pr},${pc}`;
                if (inputs[pk]) {
                  inputs[pk].value = "";
                  delete userCells[pk];
                  inputs[pk].classList.remove("wrong");
                }
                focusCell(pr, pc);
                persist();
                return;
              }
              pr += step.dr;
              pc += step.dc;
            }
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
        inp.addEventListener("click", () => inp.select());
        td.appendChild(inp);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    gridWrap.appendChild(table);

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
    checkBtn.textContent = "Check known letters";
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
    clearBtn.textContent = "Clear progress";
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all letters you entered for this puzzle?")) return;
      userCells = {};
      for (const k of Object.keys(inputs)) {
        inputs[k].value = "";
        inputs[k].classList.remove("wrong");
      }
      Prog.clearProgress(data.id, data.progressRevision);
      persist();
    });
    toolbar.appendChild(checkBtn);
    toolbar.appendChild(clearBtn);
    toolbar.appendChild(keyboardHelp);
    toolbar.appendChild(saveStatus);

    const hintBox = document.createElement("section");
    hintBox.className = "hint-box";
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
    hintBox.appendChild(directions);
    const hb = document.createElement("div");
    hb.id = "hint-basic";
    const he = document.createElement("div");
    he.id = "hint-ext";
    const lookupHelp = document.createElement("p");
    lookupHelp.className = "lookup-help muted";
    lookupHelp.textContent = "Click any clue word to look up its meaning on Google.";
    hintBox.append(hb, lookupHelp, he);

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
    gridPanel.append(gridWrap, toolbar);
    main.append(gridPanel, hintBox, cluePanels);
    cluePanels.append(cluesAc, cluesDn);

    wrap.appendChild(main);
    if (sourceReference) wrap.appendChild(sourceReference);
    rootEl.appendChild(wrap);

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
      const entries = currentEntries();
      const wordKey = entries.map((e) => `${e.type}:${e.idx}`).join(",");
      for (const d of ["across", "down"]) {
        directionButtons[d].setAttribute("aria-pressed", String(d === dir));
        const m = cellMap[ar][ac];
        directionButtons[d].disabled = (d === "across" ? m.ai : m.di) < 0;
      }
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
        hb.appendChild(h3);
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
    focusCell(firstRow, rows[firstRow].indexOf("."));
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
