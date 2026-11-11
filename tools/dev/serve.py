"""Serve the project for the dev bench, with caching off.

Browsers keep ES modules cached; without this an edited module is not
reloaded and the bench shows yesterday's code.

    python3 tools/dev/serve.py         then open http://127.0.0.1:8765/tools/dev/
"""

from __future__ import annotations

import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PORT = 8765


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        # Opening the bench also drops whatever an older server let the
        # browser keep.
        if self.path.rstrip("/").endswith("tools/dev") or "tools/dev/?" in self.path:
            self.send_header("Clear-Site-Data", '"cache"')
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # A page asks for its fifty modules at once; the default queue of five
    # resets the rest.
    request_queue_size = 128


if __name__ == "__main__":
    handler = functools.partial(NoCache, directory=str(ROOT))
    with Server(("127.0.0.1", PORT), handler) as server:
        print(f"http://127.0.0.1:{PORT}/tools/dev/")
        server.serve_forever()
