const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { createDocument, event } = require("./helpers/dom.cjs");

function mount(data, puzzleFile = "puzzles/final-assessment-2026-04-12.data.js", options = {}) {
  const document = createDocument();
  const media = {
    matches: Boolean(options.touch),
    addEventListener(type, handler) { this.change = handler; },
  };
  const saved = options.saved || new Map();
  let saves = 0;
  const context = vm.createContext({
    document,
    matchMedia: () => media,
    scrollBy: options.scrollBy || (() => {}),
    localStorage: {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => { saved.set(key, value); if (key.includes(".progress.")) saves++; },
      removeItem: (key) => saved.delete(key),
    },
    confirm: options.confirm || (() => false),
    dispatchEvent() {},
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  });
  context.window = context;
  for (const file of ["shared/progress.js", "shared/puzzle-app.js", puzzleFile, "shared/puzzle-shell.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../web", file), "utf8"), context);
  }
  if (data) context.PUZZLE_DATA = data;
  const originalOrder = JSON.stringify(context.PUZZLE_DATA.down.map((entry) => entry.pub));
  const root = document.createElement("div");
  context.mountCrosswordPuzzle(root);
  return { root, document, context, media, originalOrder, saved, saveCount: () => saves };
}

test("shell mounts the full puzzle with hints beside the board and reference last", () => {
  const { root } = mount();
  assert.equal(root.querySelectorAll("input").length, 363);
  assert.deepEqual(root.querySelector(".puzzle-main").children.map((node) => node.className),
    ["grid-panel", "hint-box", "clue-panels"]);
  assert.equal(root.querySelector(".clue-panels").querySelectorAll(".clues").length, 2);
  const reference = root.children[0].children.at(-1);
  assert.equal(reference.className, "source-reference");
  assert.equal(reference.tagName, "DETAILS");
  assert.ok(!reference.open);
  assert.ok(reference.querySelector("img"));
});

test("both clue lists are sorted by published number without changing slot order", () => {
  const { root, context, originalOrder, document } = mount();
  for (const section of root.querySelectorAll(".clues")) {
    const numbers = section.querySelectorAll(".n").map((node) => Number(node.textContent));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  }
  assert.equal(JSON.stringify(context.PUZZLE_DATA.down.map((entry) => entry.pub)), originalOrder);
  const index = context.PUZZLE_DATA.down.findIndex((entry) => entry.pub === 26);
  const button = root.querySelector(`.clue-btn[data-dir="down"][data-idx="${index}"]`);
  button.querySelector(".n").dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 26 /);
  const word = context.CrosswordEngine.extractWords(context.PUZZLE_DATA.rows).down[index];
  assert.equal(document.activeElement.dataset.r, String(word.r));
  assert.equal(document.activeElement.dataset.c, String(word.c));
});

test("double-click toggles the active clue's direction without changing saved letters", () => {
  const { root, document, saveCount } = mount();
  const input = document.activeElement;
  const saves = saveCount();
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
  assert.equal(root.querySelectorAll(".word-active").length, 5);
  const doubleClick = event("dblclick");
  input.dispatchEvent(doubleClick);
  assert.equal(doubleClick.defaultPrevented, true);
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
  assert.equal(root.querySelectorAll(".word-active").length, 4);
  input.dispatchEvent(event("dblclick"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
  assert.equal(saveCount(), saves);
  assert.equal(document.activeElement, input);
});

test("typing advances within a word and preserves expanded hints", () => {
  const { root, document } = mount();
  const hint = root.querySelector(".ext-hint");
  hint.open = true;
  document.activeElement.value = "c";
  document.activeElement.dispatchEvent(event("input"));
  assert.equal(root.querySelector(".ext-hint"), hint);
  assert.equal(hint.open, true);
  assert.equal(document.activeElement.dataset.c, "1");
  assert.match(root.querySelector(".puzzle-progress").textContent, /^1 \/ 363/);
  assert.equal(root.querySelectorAll("input").filter((node) => node.tabIndex === 0).length, 1);
});

test("Space and direction controls switch hints while Tab remains available", () => {
  const { root, document } = mount();
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
  root.querySelector(".direction-switch button").dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
  for (const shiftKey of [false, true]) {
    const tab = event("keydown", { key: "Tab", shiftKey });
    document.activeElement.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, false);
  }
});

test("arrow keys preserve the selected direction, including at grid edges", () => {
  for (const direction of ["Across", "Down"]) {
    const { root, document } = mount();
    if (direction === "Down") document.activeElement.dispatchEvent(event("keydown", { key: " " }));
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
      const arrow = event("keydown", { key });
      document.activeElement.dispatchEvent(arrow);
      assert.equal(arrow.defaultPrevented, true);
      assert.ok(root.querySelector("#hint-basic h3").textContent.startsWith(direction + " "));
    }
    assert.equal(document.activeElement.dataset.r, "0");
    assert.equal(document.activeElement.dataset.c, "0");
  }
});

test("horizontal arrows keep Down selected when skipping black squares", () => {
  const { root, document } = mount();
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  root.querySelectorAll("input").find((input) => input.dataset.r === "0" && input.dataset.c === "4").focus();
  document.activeElement.dispatchEvent(event("keydown", { key: "ArrowRight" }));
  assert.equal(document.activeElement.dataset.c, "7");
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 6 /);
  document.activeElement.dispatchEvent(event("keydown", { key: "ArrowLeft" }));
  assert.equal(document.activeElement.dataset.c, "4");
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 5 /);
});

test("typing still advances Down after moving horizontally", () => {
  const { root, document } = mount();
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  document.activeElement.dispatchEvent(event("keydown", { key: "ArrowRight" }));
  document.activeElement.value = "A";
  document.activeElement.dispatchEvent(event("input"));
  assert.equal(document.activeElement.dataset.r, "1");
  assert.equal(document.activeElement.dataset.c, "1");
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 2 /);
});

test("new clues scroll into their list viewport only as far as necessary", () => {
  for (const [top, bottom, expected] of [[300, 340, 180], [60, 90, 0], [120, 160, 40], [150, 310, 90]]) {
    const { root, document } = mount();
    const button = root.querySelector('.clue-btn[data-dir="across"][data-idx="3"]');
    const row = button.parentElement;
    const list = row.parentElement;
    list.clientHeight = 100;
    list.rect = { top: 100, bottom: 200, height: 100 };
    list.scrollTop = 40;
    row.rect = { top, bottom, height: bottom - top };
    // Move down into 19-Across using the grid, rather than clicking the clue list.
    document.activeElement.dispatchEvent(event("keydown", { key: "ArrowDown" }));
    assert.equal(button.getAttribute("aria-current"), "true");
    assert.equal(list.scrollTop, expected);
    assert.equal(document.activeElement.dataset.r, "1");
    assert.equal(document.activeElement.dataset.c, "0");
  }
});

test("switching direction scrolls the newly active list", () => {
  const { root, document } = mount();
  const button = root.querySelector('.clue-btn[data-dir="down"][data-idx="0"]');
  const list = button.parentElement.parentElement;
  list.clientHeight = 100;
  list.rect = { top: 100, bottom: 200, height: 100 };
  button.parentElement.rect = { top: 350, bottom: 390, height: 40 };
  const across = root.querySelector('.clue-btn[data-dir="across"][data-idx="0"]').parentElement.parentElement;
  across.scrollTop = 20;
  document.activeElement.dispatchEvent(event("dblclick"));
  assert.equal(list.scrollTop, 190);
  assert.equal(across.scrollTop, 20);
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
});

test("moving within the same clue preserves the user's list scroll position", () => {
  const { root, document } = mount();
  const row = root.querySelector('.clue-btn[data-dir="across"][data-idx="0"]').parentElement;
  const list = row.parentElement;
  list.clientHeight = 100;
  list.rect = { top: 100, bottom: 200, height: 100 };
  row.rect = { top: 300, bottom: 340, height: 40 };
  list.scrollTop = 25;
  document.activeElement.dispatchEvent(event("keydown", { key: "ArrowRight" }));
  assert.equal(list.scrollTop, 25);
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
});

test("double-click keeps the available direction when a cell has only one word", () => {
  const { root, document } = mount({
    id: "one-row", title: "One row", rows: [".."],
    across: [{ pub: 1, clue: "Letters", answer: "AB", hints: [] }], down: [],
  });
  document.activeElement.dispatchEvent(event("dblclick"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
  assert.equal(root.querySelectorAll(".direction-switch button")[1].disabled, true);
  assert.equal(root.querySelector(".answer-reveal p").textContent, "AB");
});

test("active clue words link to Google meanings without searching the whole clue", () => {
  const { root, saveCount } = mount();
  const button = root.querySelector('.clue-btn[data-dir="across"][data-idx="3"]');
  button.dispatchEvent(event("click"));
  const clue = root.querySelector(".basic-clue");
  assert.equal(clue.textContent, "Plane, at Orly");
  assert.deepEqual(clue.querySelectorAll("a").map((link) => link.textContent), ["Plane", "at", "Orly"]);
  const orly = clue.querySelectorAll("a")[2];
  const url = new URL(orly.getAttribute("href"));
  assert.equal(url.origin + url.pathname, "https://www.google.com/search");
  assert.equal(url.searchParams.get("q"), "Orly meaning");
  assert.equal(orly.getAttribute("target"), "_blank");
  assert.equal(orly.getAttribute("rel"), "noopener noreferrer");
  assert.match(orly.getAttribute("aria-label"), /opens in a new tab/);
  const saves = saveCount();
  orly.dispatchEvent(event("click"));
  assert.equal(saveCount(), saves);
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 19 /);
});

test("lookup links preserve accents, apostrophes, hyphens, punctuation and blanks", () => {
  const text = '“Nyong’o”, Yo-Yo, déjà-vu: ___ 2026 <img>';
  const { root } = mount({
    id: "lookup", title: "Lookup", rows: [".."],
    across: [{ pub: 1, clue: text, answer: "AB", hints: [] }], down: [],
  });
  const clue = root.querySelector(".basic-clue");
  assert.equal(clue.textContent, text);
  const links = clue.querySelectorAll("a");
  assert.deepEqual(links.map((link) => link.textContent), ["Nyong’o", "Yo-Yo", "déjà-vu", "img"]);
  assert.equal(new URL(links[2].getAttribute("href")).searchParams.get("q"), "déjà-vu meaning");
  assert.equal(clue.querySelector("img"), null);
});

test("both clue lists offer Google lookups separately from grid selection", () => {
  const { root, context, saveCount } = mount();
  for (const section of root.querySelectorAll(".clues")) {
    for (const row of section.querySelectorAll(".clue-row")) {
      assert.ok(row.querySelector(".clue-btn"));
      assert.ok(row.querySelector(".clue-text a"));
      assert.equal(row.querySelector(".clue-btn a"), null);
    }
  }
  const button = root.querySelector('.clue-btn[data-dir="across"][data-idx="3"]');
  const orly = button.parentElement.querySelectorAll(".clue-word").find((link) => link.textContent === "Orly");
  assert.equal(new URL(orly.getAttribute("href")).searchParams.get("q"), "Orly meaning");
  const saves = saveCount();
  orly.dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
  assert.equal(saveCount(), saves);
  button.dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 19 /);
  const index = context.PUZZLE_DATA.down.findIndex((entry) => entry.pub === 13);
  root.querySelector(`.clue-btn[data-dir="down"][data-idx="${index}"]`).dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 13 /);
});

test("Set a Side mounts with its own grid, hints, lookups, and numbered clue selection", () => {
  const { root, context } = mount(undefined, "puzzles/set-aside-2026-10-28.data.js");
  assert.equal(root.querySelectorAll("input").length, 191);
  assert.equal(root.querySelectorAll(".clue-btn").length, 76);
  assert.equal(root.querySelector(".puzzle-header h1").textContent, "Set a Side");
  assert.match(root.querySelector(".puzzle-progress").textContent, /0 \/ 191/);
  for (const section of root.querySelectorAll(".clues")) {
    const numbers = section.querySelectorAll(".n").map((node) => Number(node.textContent));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  }
  const index = context.PUZZLE_DATA.down.findIndex((entry) => entry.pub === 59);
  root.querySelector(`.clue-btn[data-dir="down"][data-idx="${index}"]`).dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 59 /);
  assert.equal(root.querySelectorAll("#hint-ext details").length, 4);
  assert.equal(root.querySelector(".answer-reveal p").textContent, "MAI");
  const link = root.querySelector(".basic-clue a");
  assert.equal(new URL(link.getAttribute("href")).searchParams.get("q"), "Avril meaning");
});

test("Jump Scares preserves theme fragments and keeps their explanations inside spoilers", () => {
  const { root, context } = mount(undefined, "puzzles/jump-scares-2026-10-29.data.js");
  assert.equal(root.querySelectorAll("input").length, 189);
  assert.equal(root.querySelectorAll(".clue-btn").length, 74);
  assert.equal(root.querySelector(".puzzle-header h1").textContent, "Jump Scares");
  for (const [pub, fragment] of [[18, "KCOLLECTION"], [29, "SWEETESTTA"],
    [44, "STERROCKET"], [55, "PLAYEDPEEKA"]]) {
    const index = context.PUZZLE_DATA.across.findIndex((entry) => entry.pub === pub);
    root.querySelector(`.clue-btn[data-dir="across"][data-idx="${index}"]`).dispatchEvent(event("click"));
    assert.ok(root.querySelector("#hint-basic h3").textContent.startsWith(`Across ${pub} `));
    assert.equal(root.querySelector(".answer-reveal p").textContent, fragment);
    assert.ok(!root.querySelector(".answer-reveal").open);
    assert.ok(root.querySelector(".answer-reveal .answer-explanation").textContent.includes("BOO"));
    assert.equal(root.querySelector("#hint-basic .answer-explanation"), null);
    assert.equal(root.querySelectorAll("#hint-ext details").length, 4);
  }
});

test("desktop keeps editable inputs, expanded hints, and no touch keyboard", () => {
  const scrolls = [];
  const { root, document } = mount(undefined, undefined, { scrollBy: (options) => scrolls.push(options) });
  assert.equal(root.querySelector(".touch-keyboard").hidden, true);
  assert.equal(root.querySelector(".puzzle-shell").classList.contains("touch-mode"), false);
  assert.equal(root.querySelector(".hint-extras").open, true);
  assert.ok(root.querySelectorAll("input").every((input) => !input.readOnly && input.inputMode === "text"));
  assert.equal(document.activeElement.focusOptions.preventScroll, false);
  document.activeElement.value = "C";
  document.activeElement.dispatchEvent(event("input"));
  assert.equal(document.activeElement.dataset.c, "1");
  document.activeElement.dispatchEvent(event("keydown", { key: "Backspace" }));
  assert.equal(document.activeElement.dataset.c, "0");
  assert.equal(document.activeElement.value, "");
  assert.equal(scrolls.length, 0);
});

test("small touch screens use a dedicated keyboard and collapsed hints for every puzzle", () => {
  for (const file of ["final-assessment-2026-04-12", "set-aside-2026-10-28", "jump-scares-2026-10-29", "on-the-wrong-track-2026-10-17", "all-aboard-2026-09-09"]) {
    const { root, document } = mount(undefined, `puzzles/${file}.data.js`, { touch: true });
    assert.equal(root.querySelector(".touch-keyboard").hidden, false);
    assert.equal(root.querySelector(".puzzle-shell").classList.contains("touch-mode"), true);
    assert.equal(root.querySelector(".hint-extras").open, false);
    assert.ok(root.querySelectorAll("input").every((input) => input.readOnly && input.inputMode === "none"));
    assert.equal(document.activeElement.focusOptions.preventScroll, true);
    assert.equal(root.querySelectorAll(".keyboard-key").length, file.startsWith("on-the-wrong-track") ? 28 : 27);
    assert.equal(root.querySelector(".hint-box input"), null);
    assert.equal(root.querySelector(".word-preview"), null);
    assert.equal(root.querySelectorAll(".keyboard-nav").length, 2);
    assert.equal(root.querySelector(".keyboard-top span"), null);
    assert.match(root.querySelector(".clue-meta .puzzle-progress").textContent, /^0 \/ /);
  }
});

test("touch letter keys edit the grid, save and advance, with backspace", () => {
  const { root, document } = mount(undefined, undefined, { touch: true });
  const key = root.querySelector('.keyboard-key[data-key="C"]');
  const press = event("pointerdown");
  key.dispatchEvent(press);
  assert.equal(press.defaultPrevented, true);
  key.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll(".cell-letter")[0].textContent, "C");
  assert.equal(root.querySelectorAll("input")[0].value, "C");
  assert.match(root.querySelector(".puzzle-progress").textContent, /^1 \/ 363/);
  assert.equal(document.activeElement.dataset.c, "1");
  root.querySelector('.keyboard-key[data-key="Backspace"]').dispatchEvent(event("click"));
  assert.equal(document.activeElement.dataset.c, "0");
  assert.equal(document.activeElement.value, "");
  assert.match(root.querySelector(".puzzle-progress").textContent, /^0 \/ 363/);
  assert.equal(root.querySelectorAll(".cell-letter")[0].textContent, "");
  root.querySelectorAll("input")[4].focus();
  assert.equal(document.activeElement.dataset.c, "4");
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Across 1 /);
});

test("touch phones retain hardware typing and navigate Down clues by printed number", () => {
  const { root, document } = mount(undefined, undefined, { touch: true });
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  document.activeElement.dispatchEvent(event("keydown", { key: "c" }));
  assert.equal(document.activeElement.dataset.r, "1");
  assert.equal(document.activeElement.dataset.c, "0");
  root.querySelector('.keyboard-nav[data-key="Next"]').dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 2 /);
  root.querySelectorAll(".word-nav")[0].dispatchEvent(event("click"));
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
});

test("the touch keyboard can hide and reopens when a square is tapped", () => {
  const { root, document } = mount(undefined, undefined, { touch: true });
  const keyboard = root.querySelector(".touch-keyboard");
  root.querySelector(".keyboard-toggle").dispatchEvent(event("click"));
  assert.equal(keyboard.classList.contains("collapsed"), true);
  assert.equal(root.querySelector(".keyboard-toggle").getAttribute("aria-expanded"), "false");
  document.activeElement.dispatchEvent(event("pointerdown"));
  assert.equal(keyboard.classList.contains("collapsed"), false);
  assert.equal(root.querySelector(".keyboard-toggle").getAttribute("aria-expanded"), "true");
});

test("switching back to a desktop input mode preserves letters and restores native editing", () => {
  const { root, media } = mount(undefined, undefined, { touch: true });
  root.querySelector('.keyboard-key[data-key="C"]').dispatchEvent(event("click"));
  media.matches = false;
  media.change();
  assert.equal(root.querySelector(".touch-keyboard").hidden, true);
  assert.equal(root.querySelector(".hint-extras").open, true);
  assert.equal(root.querySelector(".puzzle-shell").classList.contains("touch-mode"), false);
  assert.equal(root.querySelectorAll("input")[0].value, "C");
  assert.ok(root.querySelectorAll("input").every((input) => !input.readOnly && input.inputMode === "text"));
});

test("phone grid tools open a modal clue sheet with direction tabs and return to the selected clue", () => {
  const { root, document } = mount(undefined, undefined, { touch: true });
  const zoom = root.querySelector(".grid-tools button");
  zoom.dispatchEvent(event("click"));
  assert.equal(root.querySelector(".grid-wrap").classList.contains("zoomed"), true);
  assert.equal(zoom.textContent, "Fit grid");
  zoom.dispatchEvent(event("click"));
  assert.equal(zoom.getAttribute("aria-pressed"), "false");
  root.querySelector(".open-clues").dispatchEvent(event("click"));
  const sheet = root.querySelector(".clues-dialog");
  assert.equal(sheet.open, true);
  assert.equal(root.querySelector(".clue-panels").parentElement, sheet);
  const sections = sheet.querySelectorAll(".clues");
  assert.equal(sections[0].hidden, false);
  assert.equal(sections[1].hidden, true);
  sheet.querySelectorAll(".clues-sheet-controls button")[1].dispatchEvent(event("click"));
  assert.equal(sections[0].hidden, true);
  assert.equal(sections[1].hidden, false);
  sections[1].querySelector(".clue-btn").dispatchEvent(event("click"));
  assert.equal(sheet.open, false);
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
  assert.equal(document.activeElement.tagName, "INPUT");
});

test("touch navigation keeps the active square above the fixed keyboard", () => {
  const scrolls = [];
  const { root, document } = mount(undefined, undefined, { touch: true, scrollBy: (options) => scrolls.push(options) });
  root.querySelector(".hint-box").rect = { top: 0, bottom: 180, height: 180 };
  root.querySelector(".touch-keyboard").rect = { top: 500, bottom: 700, height: 200 };
  const destination = root.querySelectorAll("input").find((input) => input.dataset.r === "1" && input.dataset.c === "0");
  destination.parentElement.rect = { top: 570, bottom: 600, height: 30 };
  document.activeElement.dispatchEvent(event("keydown", { key: "ArrowDown" }));
  assert.equal(scrolls.at(-1).top, 108);
});

test("phone grid mistakes clear after editing the selected square", () => {
  const { root } = mount(undefined, undefined, { touch: true });
  root.querySelector('.keyboard-key[data-key="Z"]').dispatchEvent(event("click"));
  root.querySelector(".keyboard-check").dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].classList.contains("wrong"), true);
  root.querySelectorAll("input")[0].focus();
  root.querySelector('.keyboard-key[data-key="C"]').dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].classList.contains("wrong"), false);
});

test("phone progress shares the clue metadata line and survives clue and layout changes", () => {
  const { root, document, media } = mount(undefined, undefined, { touch: true });
  const count = root.querySelector(".puzzle-progress");
  assert.equal(root.querySelector(".clue-meta").children[0].tagName, "H3");
  assert.equal(root.querySelector(".clue-meta").children[1], count);
  assert.equal(root.querySelector(".puzzle-header .puzzle-progress"), null);
  root.querySelector('.keyboard-key[data-key="C"]').dispatchEvent(event("click"));
  assert.equal(count.textContent, "1 / 363 letters filled");
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  assert.equal(root.querySelector(".clue-meta .puzzle-progress"), count);
  assert.equal(root.querySelectorAll(".puzzle-progress").length, 1);
  media.matches = false;
  media.change();
  assert.equal(root.querySelector(".puzzle-header .puzzle-progress"), count);
  assert.equal(root.querySelector(".clue-meta .puzzle-progress"), null);
  media.matches = true;
  media.change();
  assert.equal(root.querySelector(".clue-meta .puzzle-progress"), count);
  assert.equal(count.textContent, "1 / 363 letters filled");
  assert.equal(root.querySelectorAll(".puzzle-progress").length, 1);
  assert.equal(root.querySelector(".puzzle-library-link").getAttribute("href"), "../index.html");
});

test("keyboard arrow buttons navigate clues in both directions without editing progress", () => {
  const { root, document, saveCount } = mount(undefined, undefined, { touch: true });
  const previous = root.querySelector('.keyboard-nav[data-key="Previous"]');
  const next = root.querySelector('.keyboard-nav[data-key="Next"]');
  assert.equal(previous.textContent, "<");
  assert.equal(next.textContent, ">");
  assert.equal(previous.getAttribute("aria-label"), "Previous clue");
  assert.equal(next.getAttribute("aria-label"), "Next clue");
  document.activeElement.dispatchEvent(event("keydown", { key: " " }));
  const saves = saveCount();
  for (const [button, number] of [[next, 2], [previous, 1], [previous, 113], [next, 1]]) {
    button.dispatchEvent(event("click"));
    assert.ok(root.querySelector("#hint-basic h3").textContent.startsWith(`Down ${number} `));
  }
  assert.equal(saveCount(), saves);
});

test("the supplied numeric crossing accepts desktop, physical and phone number input", () => {
  for (const touch of [false, true]) {
    const { root, context } = mount(undefined, "puzzles/on-the-wrong-track-2026-10-17.data.js", { touch });
    const digit = root.querySelectorAll("input").find((input) => input.dataset.r === "3" && input.dataset.c === "18");
    digit.dispatchEvent(event("focus"));
    if (touch) root.querySelector('.keyboard-key[data-key="4"]').dispatchEvent(event("click"));
    else {
      digit.value = "4";
      digit.dispatchEvent(event("input"));
    }
    assert.equal(digit.value, "4");
    const data = context.PUZZLE_DATA;
    const progress = context.CrosswordProgress.loadProgress(data.id, data.rows, data.progressRevision);
    assert.equal(progress.cells["3,18"], "4");
    assert.equal(progress.filled, 1);
    assert.equal(context.CrosswordProgress.countFilledCells(progress.cells, data.rows), 1);
    if (touch) {
      digit.dispatchEvent(event("focus"));
      digit.dispatchEvent(event("keydown", { key: "8" }));
      assert.equal(digit.value, "8");
    }
  }
});


test("phone keyboard direction stays synchronized with grid and clue navigation", () => {
  const { root, document, saveCount } = mount(undefined, undefined, { touch: true });
  const toggle = root.querySelector(".keyboard-direction");
  const cell = document.activeElement;
  const saves = saveCount();
  assert.equal(toggle.textContent, "Across →");
  toggle.dispatchEvent(event("click"));
  assert.equal(document.activeElement, cell);
  assert.equal(toggle.textContent, "Down ↓");
  assert.match(root.querySelector("#hint-basic h3").textContent, /^Down 1 /);
  assert.match(toggle.getAttribute("aria-label"), /Switch to across/);
  cell.dispatchEvent(event("keydown", { key: " " }));
  assert.equal(toggle.textContent, "Across →");
  assert.equal(saveCount(), saves);
});

test("Check and Clear move between phone keyboard and desktop toolbar without duplication", () => {
  let approved = false;
  const { root, context, media } = mount(undefined, undefined, { touch: true, confirm: () => approved });
  const check = root.querySelector(".keyboard-check");
  const clear = root.querySelector(".keyboard-clear");
  assert.equal(check.parentElement, root.querySelector(".keyboard-top"));
  assert.equal(clear.parentElement, check.parentElement);
  assert.equal(root.querySelectorAll(".toolbar button").length, 0);
  assert.equal(check.textContent, "✓");
  assert.equal(clear.getAttribute("aria-label"), "Clear progress");
  assert.ok(clear.querySelector("svg"));
  root.querySelector('.keyboard-key[data-key="Z"]').dispatchEvent(event("click"));
  check.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].classList.contains("wrong"), true);
  clear.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].value, "Z");
  approved = true;
  clear.dispatchEvent(event("click"));
  assert.ok(root.querySelectorAll("input").every((input) => !input.value && !input.classList.contains("wrong")));
  assert.equal(context.CrosswordProgress.loadProgress(context.PUZZLE_DATA.id,
    context.PUZZLE_DATA.rows, context.PUZZLE_DATA.progressRevision).filled, 0);
  media.matches = false;
  media.change();
  assert.equal(check.parentElement, root.querySelector(".toolbar"));
  assert.equal(clear.parentElement, check.parentElement);
  assert.equal(check.textContent, "Check known letters");
  assert.equal(clear.textContent, "Clear progress");
  media.matches = true;
  media.change();
  assert.equal(check.parentElement, root.querySelector(".keyboard-top"));
  assert.equal(root.querySelectorAll('.keyboard-check').length, 1);
  assert.equal(root.querySelectorAll('.keyboard-clear').length, 1);
});

function smallPuzzle() {
  return { id: "small", title: "Small", rows: ["..", ".."],
    across: [{ pub: 1, clue: "First", answer: "AB" }, { pub: 3, clue: "Second", answer: "CD" }],
    down: [{ pub: 1, clue: "First", answer: "AC" }, { pub: 2, clue: "Second", answer: "BD" }] };
}

function enterGrid(root, letters) {
  root.querySelectorAll("input").forEach((input, i) => {
    input.focus();
    input.value = letters[i];
    input.dispatchEvent(event("input"));
  });
}

test("Undo restores overwritten and deleted letters and a confirmed clear as one edit", () => {
  const { root, document } = mount(smallPuzzle(), undefined, { touch: true, confirm: () => true });
  const undo = root.querySelector(".keyboard-undo");
  assert.equal(undo.disabled, true);
  enterGrid(root, "ABCD");
  root.querySelectorAll("input")[0].focus();
  root.querySelector('.keyboard-key[data-key="Z"]').dispatchEvent(event("click"));
  undo.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].value, "A");
  assert.equal(document.activeElement, root.querySelectorAll("input")[0]);
  root.querySelector('.keyboard-key[data-key="Backspace"]').dispatchEvent(event("click"));
  undo.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input")[0].value, "A");
  root.querySelector(".keyboard-clear").dispatchEvent(event("click"));
  assert.ok(root.querySelectorAll("input").every((input) => !input.value));
  undo.dispatchEvent(event("click"));
  assert.equal(root.querySelectorAll("input").map((input) => input.value).join(""), "ABCD");
});

test("Control/Command Z undo edits without consuming ordinary letter entry", () => {
  const { root, document } = mount(smallPuzzle());
  document.activeElement.value = "Z";
  document.activeElement.dispatchEvent(event("input"));
  const undoKey = event("keydown", { key: "z", metaKey: true });
  document.activeElement.dispatchEvent(undoKey);
  assert.equal(undoKey.defaultPrevented, true);
  assert.equal(root.querySelectorAll("input")[0].value, "");
  assert.equal(root.querySelector(".undo-button").disabled, true);
});

test("reopening restores the selected square, direction, zoom and grid scroll without editing progress", () => {
  const first = mount(smallPuzzle(), undefined, { touch: true });
  first.root.querySelector(".keyboard-direction").dispatchEvent(event("click"));
  first.root.querySelectorAll("input")[3].focus();
  first.root.querySelector(".grid-tools button").dispatchEvent(event("click"));
  const grid = first.root.querySelector(".grid-wrap");
  grid.scrollLeft = 28;
  grid.scrollTop = 16;
  grid.dispatchEvent(event("scroll"));
  const second = mount(smallPuzzle(), undefined, { touch: true, saved: first.saved });
  assert.equal(second.document.activeElement.dataset.r, "1");
  assert.equal(second.document.activeElement.dataset.c, "1");
  assert.equal(second.root.querySelector(".keyboard-direction").textContent, "Down ↓");
  assert.equal(second.root.querySelector(".grid-wrap").classList.contains("zoomed"), true);
  assert.equal(second.root.querySelector(".grid-wrap").scrollLeft, 28);
  assert.equal(second.root.querySelector(".grid-wrap").scrollTop, 16);
  assert.equal(first.saveCount(), 1);
});

test("a correct grid celebrates completion and updates the library status; undo removes completion", () => {
  const { root, context } = mount(smallPuzzle(), undefined, { touch: true });
  enterGrid(root, "ABCD");
  const completion = root.querySelector(".completion-message");
  assert.equal(completion.hidden, false);
  assert.equal(completion.classList.contains("solved"), true);
  assert.match(completion.textContent, /Every answer is correct/);
  assert.equal(context.CrosswordProgress.statsForPuzzle({ id: "small", whiteCellCount: 4 }).completed, true);
  root.querySelector(".keyboard-undo").dispatchEvent(event("click"));
  assert.equal(completion.hidden, true);
  assert.equal(context.CrosswordProgress.statsForPuzzle({ id: "small", whiteCellCount: 4 }).completed, false);
});

test("a full incorrect grid prompts checking without revealing mistakes or celebrating", () => {
  const { root, context } = mount(smallPuzzle());
  enterGrid(root, "ABZD");
  const completion = root.querySelector(".completion-message");
  assert.equal(completion.hidden, false);
  assert.equal(completion.classList.contains("solved"), false);
  assert.match(completion.textContent, /Some letters need another look/);
  assert.ok(root.querySelectorAll("input").every((input) => !input.classList.contains("wrong")));
  assert.equal(context.CrosswordProgress.statsForPuzzle({ id: "small", whiteCellCount: 4 }).completed, false);
});

test("a partial key cannot certify a full grid as completed", () => {
  const data = smallPuzzle();
  data.across[1].answer = "";
  data.down.forEach((entry) => { entry.answer = ""; });
  const { root, context } = mount(data);
  enterGrid(root, "ABCD");
  assert.match(root.querySelector(".completion-message").textContent, /partial answer key/);
  assert.equal(context.CrosswordProgress.statsForPuzzle({ id: "small", whiteCellCount: 4 }).completed, false);
});

test("switching to desktop closes the clue sheet and restores both lists below the grid", () => {
  const { root, media } = mount(undefined, undefined, { touch: true });
  root.querySelector(".open-clues").dispatchEvent(event("click"));
  root.querySelector(".close-clues").dispatchEvent(event("click"));
  assert.equal(root.querySelector(".clues-dialog").open, false);
  root.querySelector(".open-clues").dispatchEvent(event("click"));
  media.matches = false;
  media.change();
  assert.equal(root.querySelector(".clues-dialog").open, false);
  assert.equal(root.querySelector(".clue-panels").parentElement, root.querySelector(".puzzle-main"));
  assert.ok(root.querySelectorAll(".clues").every((section) => !section.hidden));
  assert.equal(root.querySelector(".open-clues").hidden, true);
});


test("phone hides duplicate clue navigation and restores it on desktop", () => {
  const { root, media } = mount(undefined, undefined, { touch: true });
  const navigation = root.querySelector(".clue-navigation");
  assert.equal(navigation.hidden, true);
  assert.equal(root.querySelector(".puzzle-header").hidden, true);
  assert.equal(root.querySelector(".keyboard-navigation").hidden, undefined);
  media.matches = false;
  media.change();
  assert.equal(navigation.hidden, false);
  assert.equal(root.querySelector(".puzzle-header").hidden, false);
  media.matches = true;
  media.change();
  assert.equal(navigation.hidden, true);
});
