"""Zero-dependency web server for the demo UI."""
import json
import mimetypes
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .graph import Graph
from .projects import PROJECTS, sources_dir, story_path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")

state = {"project": "canteen", "graph": Graph.from_directory(sources_dir("canteen")), "live": 0}
lock = threading.Lock()


def set_project(key, empty=False):
    state["project"] = key
    state["graph"] = Graph() if empty else Graph.from_directory(sources_dir(key))
    state["live"] = 0


def story(key):
    path = story_path(key)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        steps = json.load(fh)
    out = []
    for s in steps:
        with open(os.path.join(sources_dir(key), s["file"]), encoding="utf-8") as fh:
            note = fh.read()
        title = next((l[2:].strip() for l in note.splitlines() if l.startswith("# ")), s["file"])
        date = next((l.split(":", 1)[1].strip() for l in note.splitlines() if l.lower().startswith("date:")), "")
        out.append({"file": s["file"], "title": title, "date": date, "chat": s["chat"], "note": note})
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        url = urlparse(self.path)
        g, key = state["graph"], state["project"]
        if url.path == "/api/graph":
            return self._json(g.to_dict())
        if url.path == "/api/status":
            return self._json({"nodes": len(g.nodes), "edges": len(g.edges),
                               "project": key, "label": PROJECTS[key]["label"], "about": PROJECTS[key]["about"],
                               "projects": {k: v["label"] for k, v in PROJECTS.items()}})
        if url.path == "/api/presets":
            return self._json({"example_note": PROJECTS[key]["example_note"]})
        if url.path == "/api/story":
            return self._json(story(key))
        if url.path == "/api/explain":
            res = g.explain(parse_qs(url.query).get("id", [""])[0])
            return self._json(res or {"error": "not found"}, 200 if res else 404)
        return self._static(url.path)

    def do_POST(self):
        url = urlparse(self.path)
        body = self._body()
        with lock:
            g = state["graph"]
            if url.path == "/api/ingest":
                state["live"] += 1
                report = g.add_source(body.get("name") or "live-note-%d.md" % state["live"], body.get("text") or "")
                return self._json(report)
            if url.path == "/api/reset":
                key = body.get("project") or state["project"]
                if key not in PROJECTS:
                    return self._json({"error": "unknown project"}, 400)
                set_project(key, bool(body.get("empty")))
                return self._json({"ok": True})
        self._json({"error": "unknown route"}, 404)

    def _static(self, path):
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.normpath(os.path.join(WEB, rel))
        if not full.startswith(WEB) or not os.path.isfile(full):
            self.send_error(404)
            return
        with open(full, "rb") as fh:
            data = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(full)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def serve(port=8000, open_browser=False, project="canteen", empty=False):
    set_project(project, empty)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = "http://127.0.0.1:%d" % port
    print("Memento is running at %s  (Ctrl+C to stop)" % url)
    if open_browser:
        import webbrowser
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
