"""Lokaler Notenrechner mit Anbindung an das HSLU-Modulverzeichnis."""
import json
import mimetypes
import re
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
API = "https://modulverzeichnis.hslu.ch/api/v1/modules"


def hslu(suffix="", data=None):
    request = Request(API + suffix, data=json.dumps(data).encode() if data else None,
                      headers={"Accept": "application/json", "Content-Type": "application/json"})
    with urlopen(request, timeout=12) as response:
        return json.load(response)


def search(query, field, offset):
    filters = {key: [] for key in (
        "idModulbeschreibung departemente studiengang organisationen durchfuehrung "
        "modulniveau modultyp unterrichtsform unterrichtsintervall unterrichtssprache").split()}
    filters.update(dict.fromkeys(("isISAModul", "isSprachenzentrumModul", "isProjektmodul",
                                 "isBlockwoche", "projektmodul", "showModuleMitIndividuellenCredits")))
    filters.update(modulname="", modulnummer="", gueltigVon=f"{date.today()}T00:00:00.000Z")
    filters[field] = query
    rows = hslu(data=dict(skip=offset, take=30, sortFieldId=3, sortDirectionId=1, filter=filters))
    if not isinstance(rows, list) or any(not isinstance(row, dict) or not row.get("id")
                                        or not row.get("modulname") for row in rows):
        raise ValueError("Ungültige Modulliste")
    return rows


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        route = url.path
        if route.startswith("/api/"):
            try:
                if route == "/api/modules":
                    args = parse_qs(url.query)
                    query = args.get("q", [""])[0][:200]
                    offset = args.get("offset", ["0"])[0]
                    field = args.get("field", ["modulname"])[0]
                    if field not in ("modulname", "modulnummer") or not re.fullmatch(r"[0-9]{1,7}", offset):
                        return self.send_error(400)
                    result = search(query, field, int(offset))
                elif re.fullmatch(r"/api/modules/[0-9]+", route):
                    result = hslu("/" + route.rsplit("/", 1)[1])
                    if not isinstance(result, dict) or not result.get("modulname"):
                        raise ValueError("Ungültige Moduldetails")
                else:
                    return self.send_error(404)
                return self.reply(200, "application/json", json.dumps(result).encode())
            except (OSError, ValueError):
                return self.reply(502, "application/json", b'{"error":"HSLU nicht erreichbar"}')
        filename = route.lstrip("/") or "index.html"
        if filename not in {"index.html", "modules.js", "script.js", "style.css",
                            "assets/hslu-logo.svg", "assets/topo.svg"}:
            return self.send_error(404)
        self.reply(200, mimetypes.guess_type(filename)[0], (ROOT / filename).read_bytes())

    def reply(self, status, mime, body):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("Notenrechner unter http://localhost:8000 öffnen.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
