const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function runtime(storage = {}) {
  const context = vm.createContext({ localStorage: storage });
  for (const file of ["puzzle-app.js", "progress.js"]) {
    vm.runInContext(read("web/shared/" + file), context);
  }
  return context;
}

function puzzle() {
  return {
    id: "test", title: "Test puzzle", rows: ["..", ".."],
    across: [
      { pub: 1, clue: "First", hints: [], answer: "AB" },
      { pub: 3, clue: "Second", hints: [], answer: "CD" },
    ],
    down: [
      { pub: 1, clue: "First", hints: [], answer: "AC" },
      { pub: 2, clue: "Second", hints: [], answer: "BD" },
    ],
  };
}

test("bundled puzzles satisfy the schema and manifest cell counts", () => {
  const context = runtime();
  context.window = context;
  const manifest = JSON.parse(read("web/manifest.json"));
  for (const meta of manifest.puzzles) {
    vm.runInContext(read("web/" + meta.href.replace(/\.html$/, ".data.js")), context);
    const data = context.PUZZLE_DATA;
    assert.equal(data.id, meta.id);
    assert.equal(data.progressRevision, meta.progressRevision);
    context.CrosswordEngine.validatePuzzle(data);
    assert.equal(context.CrosswordProgress.countWhiteCells(data.rows), meta.whiteCellCount);
  }
});

test("word extraction preserves across row order and down column order", () => {
  const { CrosswordEngine: engine } = runtime();
  const words = engine.extractWords(["..#", "...", "#.."]);
  assert.equal(JSON.stringify(words.across), JSON.stringify([
    { r: 0, c: 0, len: 2 }, { r: 1, c: 0, len: 3 }, { r: 2, c: 1, len: 2 },
  ]));
  assert.equal(JSON.stringify(words.down), JSON.stringify([
    { r: 0, c: 0, len: 2 }, { r: 0, c: 1, len: 3 }, { r: 1, c: 2, len: 2 },
  ]));
});

for (const [name, change, error] of [
  ["empty grid", (d) => { d.rows = []; }, /grid is empty/],
  ["unequal rows", (d) => { d.rows[1] = "."; }, /equal width/],
  ["invalid grid characters", (d) => { d.rows[0] = "x."; }, /only . or #/],
  ["all black grid", (d) => { d.rows = ["##", "##"]; }, /no white cells/],
  ["missing clues", (d) => { d.across.pop(); }, /clue count/],
  ["incorrect answer length", (d) => { d.across[0].answer = "ABC"; }, /slot length/],
  ["conflicting crossing", (d) => { d.down[0].answer = "ZZ"; }, /answers conflict/],
  ["invalid hints", (d) => { d.across[0].hints = [3]; }, /hints must be non-empty strings/],
  ["empty hints", (d) => { d.across[0].hints = [" "]; }, /non-empty strings/],
  ["invalid answer explanations", (d) => { d.across[0].answerExplanation = {}; }, /answerExplanation/],
  ["wrong clue numbering", (d) => { d.down[0].pub = 9; }, /numbered grid start/],
  ["duplicate clue numbering", (d) => { d.across[1].pub = 1; }, /numbered grid start/],
]) {
  test("rejects " + name, () => {
    const data = puzzle();
    change(data);
    assert.throws(() => runtime().CrosswordEngine.validatePuzzle(data), error);
  });
}

test("Final Assessment matches the source screenshot grid and printed clue numbers", () => {
  const context = runtime();
  context.window = context;
  vm.runInContext(read("web/puzzles/final-assessment-2026-04-12.data.js"), context);
  const data = JSON.parse(JSON.stringify(context.PUZZLE_DATA));
  const source = JSON.parse(read("tests/fixtures/final-assessment-source.json"));
  assert.deepEqual(data.rows, source.rows);
  assert.equal(data.rows.length, 21);
  assert.ok(data.rows.every((row) => row.length === 21));
  assert.equal(context.CrosswordProgress.countWhiteCells(data.rows), 363);
  assert.deepEqual(data.across.map((entry) => entry.pub).sort((a, b) => a - b), source.acrossNumbers);
  assert.deepEqual(data.down.map((entry) => entry.pub).sort((a, b) => a - b), source.downNumbers);
  assert.equal(data.across.length, 61);
  assert.equal(data.down.length, 77);
  for (const [dir, pub, answer, clueFragment] of [
    ["across", 1, "CELLI", "Yo-Yo"],
    ["across", 19, "AVION", "Orly"],
    ["across", 64, "RONAN", "Saoirse"],
    ["down", 13, "IMET", "Your Mother"],
    ["down", 26, "OONA", "Chaplin"],
    ["down", 39, "NUI", "Easter Island"],
    ["down", 91, "IGOR", "Stravinsky"],
    ["down", 113, "KIT", "Young fox"],
  ]) {
    const entry = data[dir].find((entry) => entry.pub === pub);
    assert.equal(entry.answer, answer);
    assert.ok(entry.clue.includes(clueFragment));
  }
});

test("Final Assessment has a full solution and distinct, non-placeholder hint tiers", () => {
  const context = runtime();
  context.window = context;
  vm.runInContext(read("web/puzzles/final-assessment-2026-04-12.data.js"), context);
  const data = context.PUZZLE_DATA;
  const words = context.CrosswordEngine.validatePuzzle(data);
  const map = context.CrosswordEngine.buildCellMap(data.rows, words.across, words.down);
  const cells = {};
  const hints = [];
  for (const dir of ["across", "down"]) {
    data[dir].forEach((entry, i) => {
      assert.ok(entry.answer, `${dir} ${entry.pub} is missing an answer`);
      assert.equal(entry.hints.length, 3);
      for (const hint of entry.hints) {
        assert.ok(hint.trim());
        assert.doesNotMatch(hint, /Start with the most direct|Let crossings narrow|skip and return|letters long in the grid/i);
        hints.push(hint);
      }
      if (dir !== "across") return;
      const word = words.across[i];
      [...entry.answer].forEach((letter, k) => { cells[`${word.r},${word.c + k}`] = letter; });
    });
  }
  assert.equal(hints.length, 414);
  assert.equal(new Set(hints).size, hints.length);
  const result = context.CrosswordEngine.countCorrectCells(data.rows, map, cells,
    words.across, words.down, data.across.map((entry) => entry.answer), data.down.map((entry) => entry.answer));
  assert.equal(result.checkable, 363);
  assert.equal(result.correct, 363);
});

for (const spec of [
  { slug: "all-aboard", title: "All Aboard!", author: "Jerry Miccolis", date: "2026-09-09",
    cells: 189, across: 39, down: 39, hints: 234,
    themes: [[16, "SOFTLAUNCH"], [23, "SCHOLARSHIP"], [34, "HEADLINER"], [48, "NAILCLIPPER"], [57, "STAGECRAFT"]] },
  { slug: "on-the-wrong-track", title: "On the Wrong Track", author: "Brad Wiegmann", date: "2026-10-17",
    size: 21, cells: 363, across: 67, down: 73, hints: 420,
    themes: [[22, "SAYMYNAME"], [27, "ILLTUMBLE4YA"], [32, "BRICKHOUSE"], [50, "CROCODILEROCK"],
      [66, "BADLIAR"], [81, "SPINNINGWHEEL"], [95, "FREEFALLIN"], [102, "SOAKUPTHESUN"], [112, "HOTHOTHOT"]] },
  { slug: "set-aside", title: "Set a Side", author: "Christopher Youngs", date: "2026-10-28",
    cells: 191, across: 39, down: 37, hints: 228,
    themes: [[20, "KEEPINGABREAST"], [34, "TAKENABACK"], [41, "THINKAHEAD"], [55, "THEGAMEISAFOOT"], [67, "APART"]] },
  { slug: "jump-scares", title: "Jump Scares", author: "Mike Shenk", date: "2026-10-29",
    cells: 189, across: 35, down: 39, hints: 222,
    themes: [[18, "KCOLLECTION"], [29, "SWEETESTTA"], [44, "STERROCKET"], [55, "PLAYEDPEEKA"]] },
]) {
  test(`${spec.title} matches both supplied screenshots, including every solution letter`, () => {
    const context = runtime();
    context.window = context;
    vm.runInContext(read(`web/puzzles/${spec.slug}-${spec.date}.data.js`), context);
    const data = JSON.parse(JSON.stringify(context.PUZZLE_DATA));
    const source = JSON.parse(read(`tests/fixtures/${spec.slug}-source.json`));
    const engine = context.CrosswordEngine;
    const words = engine.validatePuzzle(data);
    assert.equal(data.title, spec.title);
    assert.equal(data.author, spec.author);
    assert.equal(data.publishedDate, spec.date);
    assert.deepEqual(data.rows, source.rows);
    assert.equal(data.rows.length, spec.size || 15);
    assert.ok(data.rows.every((row) => row.length === (spec.size || 15)));
    assert.equal(context.CrosswordProgress.countWhiteCells(data.rows), spec.cells);
    assert.equal(data.across.length, spec.across);
    assert.equal(data.down.length, spec.down);
    assert.ok(fs.existsSync(path.join(root, source.sourceScreenshot)));
    assert.ok(fs.existsSync(path.join(root, source.solutionScreenshot)));
    assert.deepEqual(source.solutionRows.map((row) => row.replace(/[A-Z0-9]/g, ".")), data.rows);
    const hints = [];
    for (const direction of ["across", "down"]) {
      assert.deepEqual(data[direction].map((entry) => entry.pub).sort((a, b) => a - b),
        source[direction + "Numbers"]);
      data[direction].forEach((entry, i) => {
        const word = words[direction][i];
        const expected = Array.from({ length: word.len }, (_, k) =>
          source.solutionRows[word.r + (direction === "down" ? k : 0)][word.c + (direction === "across" ? k : 0)]
        ).join("");
        assert.equal(entry.answer, expected, `${direction} ${entry.pub}`);
        assert.equal(entry.hints.length, 3);
        assert.ok(entry.hints.every((hint) => hint.trim()));
        hints.push(...entry.hints);
      });
    }
    assert.equal(hints.length, spec.hints);
    assert.equal(new Set(hints).size, spec.hints);
    const cells = {};
    source.solutionRows.forEach((row, r) => [...row].forEach((letter, c) => {
      if (letter !== "#") cells[`${r},${c}`] = letter;
    }));
    const map = engine.buildCellMap(data.rows, words.across, words.down);
    const score = engine.countCorrectCells(data.rows, map, cells, words.across, words.down,
      data.across.map((entry) => entry.answer), data.down.map((entry) => entry.answer));
    assert.equal(score.correct, spec.cells);
    assert.equal(score.checkable, spec.cells);
    for (const [pub, answer] of spec.themes) {
      assert.equal(data.across.find((entry) => entry.pub === pub).answer, answer);
    }
  });
}

test("Jump Scares theme fragments combine with adjacent BOO entries into full answers", () => {
  const context = runtime();
  context.window = context;
  vm.runInContext(read("web/puzzles/jump-scares-2026-10-29.data.js"), context);
  const data = context.PUZZLE_DATA;
  for (const [pub, scare, prefix, full] of [
    [18, 17, true, "BOOKCOLLECTION"], [29, 32, false, "SWEETESTTABOO"],
    [44, 43, true, "BOOSTERROCKET"], [55, 59, false, "PLAYEDPEEKABOO"],
  ]) {
    const entry = data.across.find((entry) => entry.pub === pub);
    const boo = data.across.find((entry) => entry.pub === scare);
    assert.equal(boo.answer, "BOO");
    assert.equal(prefix ? boo.answer + entry.answer : entry.answer + boo.answer, full);
    assert.ok(entry.answerExplanation.includes(`${scare}-Across`));
  }
});

test("corrected puzzle saves are isolated from the original grid's progress", () => {
  const entries = new Map();
  const progress = runtime({
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }).CrosswordProgress;
  progress.saveProgress("test", { cells: { "0,0": "A" }, total: 360 });
  const oldSave = entries.get(progress.key("test"));
  assert.equal(progress.loadProgress("test", undefined, 2), null);
  progress.saveProgress("test", { cells: { "0,0": "C" }, total: 363 }, 2);
  assert.equal(progress.loadProgress("test", undefined, 2).cells["0,0"], "C");
  assert.equal(progress.statsForPuzzle({ id: "test", progressRevision: 2 }).total, 363);
  assert.equal(entries.get(progress.key("test")), oldSave);
  progress.clearProgress("test", 2);
  assert.equal(progress.loadProgress("test", undefined, 2), null);
  assert.equal(entries.get(progress.key("test")), oldSave);
});

test("supports grids whose first cell is black", () => {
  const data = puzzle();
  data.rows = ["#..", "#.."];
  const words = runtime().CrosswordEngine.validatePuzzle(data);
  assert.equal(words.across[0].c, 1);
});

test("partial answer sets count only checkable cells", () => {
  const engine = runtime().CrosswordEngine;
  const rows = ["..", ".."];
  const words = engine.extractWords(rows);
  const map = engine.buildCellMap(rows, words.across, words.down);
  const counts = engine.countCorrectCells(rows, map,
    { "0,0": "A", "0,1": "Z", "1,0": "C" },
    words.across, words.down, ["AB", ""], ["", ""]);
  assert.equal(counts.correct, 1);
  assert.equal(counts.checkable, 2);
});

test("storage write and delete failures return false without throwing", () => {
  const fail = () => { throw new Error("Unavailable"); };
  const progress = runtime({ getItem: fail, setItem: fail, removeItem: fail }).CrosswordProgress;
  assert.equal(progress.loadProgress("test"), null);
  assert.equal(progress.saveProgress("test", { cells: {} }), false);
  assert.equal(progress.clearProgress("test"), false);
});

test("storage success returns true and records the payload", () => {
  const entries = new Map();
  const progress = runtime({
    getItem: (key) => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }).CrosswordProgress;
  assert.equal(progress.saveProgress("test", { cells: { "0,0": "A" } }), true);
  assert.equal(progress.loadProgress("test").cells["0,0"], "A");
  assert.ok(progress.loadProgress("test").updatedAt > 0);
  assert.equal(progress.clearProgress("test"), true);
  assert.equal(progress.loadProgress("test"), null);
});

test("saved cells are sanitized against the current grid", () => {
  const progress = runtime({ getItem: () => JSON.stringify({
    cells: { "0,0": "a", "0,1": "B", "0,2": 3, "9,9": "C", "-1,0": "D", bad: "E" },
    filled: 999, total: "bad", correctCount: -1,
  }) }).CrosswordProgress;
  const saved = progress.loadProgress("test", [".#."]);
  assert.equal(JSON.stringify(saved.cells), '{"0,0":"A"}');
  assert.equal(saved.filled, 1);
  assert.equal(saved.total, undefined);
  assert.equal(saved.correctCount, undefined);
});

test("malformed storage JSON and non-object payloads are ignored", () => {
  for (const value of ["{", "null", "[]", '"text"', "5"]) {
    assert.equal(runtime({ getItem: () => value }).CrosswordProgress.loadProgress("test"), null);
  }
});

// Minimal elements for the index's loading/error paths; UI behavior needs a browser.
function element(tag) {
  return {
    tag, children: [], listeners: {}, textContent: "", html: "",
    set innerHTML(value) { this.html = value; this.children = []; },
    get innerHTML() { return this.html; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    setAttribute() {},
    addEventListener(name, listener) { this.listeners[name] = listener; },
  };
}

function indexRuntime(fetch) {
  const tbody = element("tbody");
  const context = vm.createContext({
    fetch,
    document: { getElementById: () => tbody, createElement: element },
    window: { CrosswordProgress: { statsForPuzzle: () => ({ total: 0 }) }, addEventListener() {} },
  });
  const inline = read("web/index.html").match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(inline, context);
  return { context, tbody };
}

for (const [name, fetch] of [
  ["network error", async () => { throw new Error("Offline"); }],
  ["HTTP error", async () => ({ ok: false, status: 404 })],
  ["invalid JSON", async () => ({ ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } })],
  ["invalid schema", async () => ({ ok: true, json: async () => ({ puzzles: [null] }) })],
]) {
  test("index shows a retry action after " + name, async () => {
    const { tbody } = indexRuntime(fetch);
    await new Promise(setImmediate);
    const cell = tbody.children[0].children[0];
    assert.match(cell.children[0].textContent, /Could not load the puzzle list/);
    assert.equal(cell.children[1].textContent, "Retry");
    assert.equal(typeof cell.children[1].listeners.click, "function");
  });
}

test("retry replaces the error with the loaded puzzle list", async () => {
  let offline = true;
  const { tbody } = indexRuntime(async () => {
    if (offline) throw new Error("Offline");
    return { ok: true, json: async () => JSON.parse(read("web/manifest.json")) };
  });
  await new Promise(setImmediate);
  const retry = tbody.children[0].children[0].children[1];
  offline = false;
  await retry.listeners.click();
  assert.equal(tbody.children.length, JSON.parse(read("web/manifest.json")).puzzles.length);
  assert.match(tbody.children.map((row) => row.innerHTML).join(""), /Final Assessment/);
});

test("manifest rejects duplicate IDs and invalid puzzle URLs", async () => {
  const { context } = indexRuntime(async () => ({ ok: true, json: async () => ({ puzzles: [] }) }));
  const meta = JSON.parse(read("web/manifest.json")).puzzles[0];
  assert.throws(() => context.validateManifest({ puzzles: [meta, meta] }), /duplicate/);
  assert.throws(() => context.validateManifest({ puzzles: [{ ...meta, href: "javascript:alert(1)" }] }), /invalid/);
  await new Promise(setImmediate);
});
