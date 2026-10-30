.DEFAULT_GOAL := serve

PORT ?= 8000
PYTHON ?= python3

define CROSSWORD_SERVER_CODE
import functools
import http.server
import signal
import subprocess
import sys
import urllib.parse

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        url = urllib.parse.urlsplit(self.path)
        if not url.path.startswith("/crosswords/"):
            path = "/crosswords/" if url.path == "/crosswords" else "/crosswords" + url.path
            self.send_response(302)
            self.send_header("Location", urllib.parse.urlunsplit(("", "", path, url.query, "")))
            self.end_headers()
            return None
        return super().send_head()

    def translate_path(self, path):
        url = urllib.parse.urlsplit(path)
        path = urllib.parse.urlunsplit(("", "", url.path[len("/crosswords"):], url.query, ""))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

handler = functools.partial(DevHandler, directory="web")
with http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), handler) as server:
    url = "http://localhost:" + str(server.server_port) + "/crosswords/"
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    print("Serving " + url + " (Ctrl+C to stop)", flush=True)
    subprocess.run(["open", "-a", "Google Chrome", url], check=True)
    server.serve_forever()
endef
export CROSSWORD_SERVER_CODE

.PHONY: serve test

serve:
	@$(PYTHON) -c "$$CROSSWORD_SERVER_CODE" '$(PORT)'

test:
	node --test tests/*.test.cjs
