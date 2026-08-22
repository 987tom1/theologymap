"""THROWAWAY — 1a discovery only. Env var NAMES (never values) + bundle layout.
Sanctioned by phase-1-design.md §4/§5. Deleted before 1a merges."""
from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def listing(p, depth=2):
    try:
        out = []
        for child in sorted(p.iterdir()):
            out.append(child.name + ("/" if child.is_dir() else ""))
            if child.is_dir() and depth > 1:
                out += [child.name + "/" + n for n in listing(child, depth - 1)]
        return out
    except Exception as exc:
        return [f"<{exc}>"]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        info = {
            "env_names": sorted(n for n in os.environ
                                if re.search(r"SUPABASE|POSTGRES|DATABASE", n)),
            "all_env_names": sorted(os.environ),
            "root": str(ROOT),
            "cwd": os.getcwd(),
            "root_listing": listing(ROOT),
            "sys_path_head": sys.path[:6],
        }
        try:
            sys.path.insert(0, str(ROOT / "engine"))
            import render as render_engine
            info["render_import"] = "ok"
            info["has_render_markdown"] = hasattr(render_engine, "render_markdown")
        except Exception:
            info["render_import"] = traceback.format_exc(limit=3)
        try:
            sys.path.insert(0, str(ROOT / "api"))
            import _lib
            info["lib_import"] = "ok"
            info["lib_has_pg"] = hasattr(_lib, "pg")
        except Exception:
            info["lib_import"] = traceback.format_exc(limit=3)
        try:
            v = (ROOT / "documentation" / "verses.md")
            info["verses_exists"] = v.exists()
        except Exception as exc:
            info["verses_exists"] = str(exc)

        payload = json.dumps(info, indent=1).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
