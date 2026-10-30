const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { createDocument, event } = require("./helpers/dom.cjs");

function mount(data, puzzleFile = "puzzles/final-assessment-2026-04-12.data.js") {
  const document = createDocument();
  const saved = new Map();
  let saves = 0;
  const context = vm.createContext({
    document,
    localStorage: {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => { saved.set(key, value); saves++; },
      removeItem: (key) => saved.delete(key),
    },
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
  return { root, document, context, originalOrder, saveCount: () => saves };
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
