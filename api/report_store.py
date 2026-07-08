"""Shared latest-report store, per market (server-side, global to all users).

Persists the most recently generated screening result to a JSON file per market id
(e.g. fno, n500) so every visitor sees the same report. Replaced on a new generate,
removed on reset; no time-based expiry, and no database — just files.

Set REPORT_DIR to a Railway volume path to survive redeploys; otherwise reports persist
until the next deploy/restart."""

import json
import os
import re
import threading
from pathlib import Path
from typing import Any

_DIR = Path(os.environ.get("REPORT_DIR", str(Path(__file__).resolve().parent.parent / "data")))
_lock = threading.Lock()


def _path(market: str) -> Path:
    safe = re.sub(r"[^a-z0-9_-]", "", (market or "default").lower())[:40] or "default"
    return _DIR / f"report_{safe}.json"


def load(market: str) -> dict[str, Any] | None:
    with _lock:
        try:
            p = _path(market)
            if p.exists():
                return json.loads(p.read_text("utf-8"))
        except (OSError, ValueError):
            return None
    return None


def save(market: str, report: Any, saved_at: int) -> None:
    with _lock:
        _DIR.mkdir(parents=True, exist_ok=True)
        p = _path(market)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps({"savedAt": saved_at, "report": report}), "utf-8")
        tmp.replace(p)  # atomic-ish swap


def clear(market: str) -> None:
    with _lock:
        try:
            _path(market).unlink()
        except FileNotFoundError:
            pass
