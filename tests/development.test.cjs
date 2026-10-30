const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("make mounts the app at /crosswords/, disables caching, and opens Chrome", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crosswords-server-"));
  const wrapper = path.join(directory, "check_server.py");
  fs.writeFileSync(wrapper, `
import http.server
import http.client
import io
import json
import signal
import subprocess
import sys
from unittest.mock import patch

source = sys.argv[2]
port = int(sys.argv[3])
compile(source, "<make serve>", "exec")
with patch.object(http.server, "ThreadingHTTPServer") as server_factory, \\
     patch.object(subprocess, "run") as launch, \\
     patch.object(signal, "signal"), \\
     patch.object(sys, "argv", ["-c", str(port)]):
    server = server_factory.return_value.__enter__.return_value
    server.server_port = port
    exec(source, {})
    assert server_factory.call_args.args[0] == ("127.0.0.1", port)
    handler = server_factory.call_args.args[1]
    assert handler.keywords["directory"] == "web"
    launch.assert_called_once_with(
        ["open", "-a", "Google Chrome", "http://localhost:" + str(port) + "/crosswords/"],
        check=True,
    )
    server.serve_forever.assert_called_once()
    server_factory.return_value.__exit__.assert_called_once()
    response = handler.func.__new__(handler.func)
    response.request_version = "HTTP/1.1"
    response.wfile = io.BytesIO()
    response.end_headers()
    assert b"Cache-Control: no-store\\r\\n" in response.wfile.getvalue()

# Exercise real HTTP parsing and static-file serving without opening a socket.
class Connection:
    def __init__(self, request):
        self.request = request
        self.output = bytearray()
    def makefile(self, *args):
        return io.BytesIO(self.request)
    def sendall(self, data):
        self.output.extend(data)

def request(path, method="GET"):
    connection = Connection((method + " " + path + " HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n").encode())
    with patch.object(handler.func, "log_message"):
        handler(connection, ("127.0.0.1", 12345), server)
    result = http.client.HTTPResponse(Connection(bytes(connection.output)), method=method)
    result.begin()
    assert result.getheader("Cache-Control") == "no-store"
    return result

for old, new in [
    ("/", "/crosswords/"),
    ("/crosswords", "/crosswords/"),
    ("/crosswords?q=test", "/crosswords/?q=test"),
    ("/puzzles/jump-scares-2026-10-29.html?v=8", "/crosswords/puzzles/jump-scares-2026-10-29.html?v=8"),
]:
    result = request(old)
    assert result.status == 302
    assert result.getheader("Location") == new

result = request("/crosswords/")
assert result.status == 200
assert b"Crossword puzzles" in result.read()
result = request("/crosswords/manifest.json")
assert result.status == 200
manifest = json.loads(result.read())
for puzzle in manifest["puzzles"]:
    result = request("/crosswords/" + puzzle["href"])
    assert result.status == 200
    assert puzzle["title"].encode() in result.read()
    result = request("/crosswords/" + puzzle["href"].replace(".html", ".data.js") + "?v=8")
    assert result.status == 200
    assert b"PUZZLE_DATA" in result.read()

assert request("/crosswords/shared/puzzle-shell.js?v=8").status == 200
assert request("/crosswords/styles.css?v=8").status == 200
result = request("/crosswords/screenshots/jump-scares-2026-10-29.png")
assert result.status == 200
assert result.read().startswith(b"\\x89PNG")
result = request("/crosswords/manifest.json", "HEAD")
assert result.status == 200
assert result.read() == b""
result = request("/crosswords/shared")
assert result.status == 301
assert result.getheader("Location") == "/crosswords/shared/"
assert request("/crosswords/missing.html").status == 404
`);
  try {
    for (const port of ["8000", "8080"]) {
      const result = spawnSync("make", ["serve", `PORT=${port}`, `PYTHON=python3 ${wrapper}`], {
        cwd: root, encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("puzzle pages load their matching data and versioned shared scripts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "web/manifest.json"), "utf8"));
  for (const puzzle of manifest.puzzles) {
    const page = path.join(root, "web", puzzle.href);
    const html = fs.readFileSync(page, "utf8");
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(scripts.length, 4);
    const versions = scripts.map((src) => new URL(src, "http://localhost/crosswords/puzzles/").searchParams.get("v"));
    assert.ok(versions.every(Boolean));
    assert.equal(new Set(versions).size, 1);
    assert.equal(scripts[2].split("?")[0], path.basename(puzzle.href, ".html") + ".data.js");
    for (const src of scripts) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(page), src.split("?")[0])));
    }
  }
});
