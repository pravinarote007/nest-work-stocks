"""Shared latest-report store (server-side, global to all users).

Persists the most recently generated screening result to a JSON file so every visitor
sees the same report. It is replaced when a new report is generated and removed on reset;
there is no time-based expiry.

On Railway, mount a volume and point REPORT_PATH at it (e.g. REPORT_PATH=/data/report.json)
to survive redeploys; otherwise it persists until the next deploy/restart."""

import json
import os
import threading
from pathlib import Path
from typing import Any

_PATH = Path(
    os.environ.get("REPORT_PATH", str(Path(__file__).resolve().parent.parent / "data" / "report.json"))
)
_lock = threading.Lock()


def load() -> dict[str, Any] | None:
    with _lock:
        try:
            if _PATH.exists():
                return json.loads(_PATH.read_text("utf-8"))
        except (OSError, ValueError):
            return None
    return None


def save(report: Any, saved_at: int) -> None:
    with _lock:
        _PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps({"savedAt": saved_at, "report": report}), "utf-8")
        tmp.replace(_PATH)  # atomic-ish swap


def clear() -> None:
    with _lock:
        try:
            _PATH.unlink()
        except FileNotFoundError:
            pass
