const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("Pages package is self-contained and its links resolve under /crosswords/", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crosswords-pages-"));
  try {
    fs.copyFileSync(path.join(root, "Makefile"), path.join(directory, "Makefile"));
    fs.cpSync(path.join(root, "web"), path.join(directory, "web"), { recursive: true, verbatimSymlinks: true });
    fs.cpSync(path.join(root, "screenshots"), path.join(directory, "screenshots"), { recursive: true });
    const output = path.join(directory, "_site");
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, "stale.html"), "old build");
    const build = () => {
      const result = spawnSync("make", ["pages"], { cwd: directory, encoding: "utf8" });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    build();
    assert.ok(!fs.existsSync(path.join(output, "stale.html")));
    assert.ok(fs.existsSync(path.join(output, ".nojekyll")));
    assert.equal(fs.lstatSync(path.join(output, "screenshots")).isSymbolicLink(), false);
    for (const excluded of [".git", ".github", "README.md", "AGENTS.md", "tests", "Makefile"]) {
      assert.ok(!fs.existsSync(path.join(output, excluded)));
    }

    const base = "https://dantai74.github.io/crosswords/";
    const resolveAsset = (href, page = base) => {
      const url = new URL(href, page);
      assert.equal(url.origin, "https://dantai74.github.io");
      assert.ok(url.pathname.startsWith("/crosswords/"));
      const file = path.join(output, decodeURIComponent(url.pathname.slice("/crosswords/".length)));
      assert.ok(fs.existsSync(file), `Missing deployed asset: ${url}`);
      return file;
    };
    const inspect = (directory) => {
      for (const name of fs.readdirSync(directory)) {
        assert.notEqual(name, ".DS_Store");
        const file = path.join(directory, name);
        const stat = fs.lstatSync(file);
        assert.equal(stat.isSymbolicLink(), false, file);
        if (stat.isDirectory()) inspect(file);
        if (!file.endsWith(".html")) continue;
        const page = new URL(path.relative(output, file).split(path.sep).join("/"), base);
        const markup = fs.readFileSync(file, "utf8")
          .replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, "$1</script>");
        for (const [, href] of markup.matchAll(/(?:src|href)="([^"]+)"/g)) {
          resolveAsset(href, page);
        }
      }
    };
    inspect(output);
    const manifest = JSON.parse(fs.readFileSync(resolveAsset("manifest.json"), "utf8"));
    for (const puzzle of manifest.puzzles) {
      const page = new URL(puzzle.href, base);
      const dataFile = resolveAsset(puzzle.href.replace(/\.html$/, ".data.js"));
      const context = { window: {} };
      vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), context);
      resolveAsset(context.window.PUZZLE_DATA.sourceScreenshot, page);
      const screenshot = resolveAsset(puzzle.screenshot);
      assert.deepEqual(fs.readFileSync(screenshot), fs.readFileSync(path.join(root, puzzle.screenshot)));
    }

    // Packaging also works when a checkout has no screenshots symlink.
    fs.rmSync(path.join(directory, "web/screenshots"), { recursive: true, force: true });
    build();
    resolveAsset("screenshots/jump-scares-2026-10-29.png");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
