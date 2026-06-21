"""NSE Bhavcopy fetcher — official end-of-day equity data.

We download the daily UDiFF Common-Equity Bhavcopy for the current and previous calendar
month, then aggregate each symbol's daily bars into a monthly bar:
    month open  = first trading day's open
    month high  = max daily high
    month low   = min daily low
    month close = last trading day's close

NSE blocks naive requests, so we prime a session (browser-like headers + homepage cookie)
before hitting the archive. Non-trading days (weekends/holidays) simply 404 and are skipped.
"""

from __future__ import annotations

import calendar
import io
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from typing import Any

import requests

ARCHIVE = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{ymd}_F_0000.csv.zip"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(_HEADERS)
    try:
        # Prime cookies; NSE rejects archive requests without a prior homepage hit.
        s.get("https://www.nseindia.com", timeout=10)
    except requests.RequestException:
        pass
    return s


def _trading_days(year: int, month: int, upto: date | None = None) -> list[date]:
    last = calendar.monthrange(year, month)[1]
    end = last if upto is None else min(last, upto.day)
    days = []
    for d in range(1, end + 1):
        dt = date(year, month, d)
        if dt.weekday() < 5:  # Mon–Fri (holidays handled by 404 skip)
            days.append(dt)
    return days


def _download_day(session: requests.Session, dt: date) -> dict[str, dict[str, float]] | None:
    """Return {SYMBOL: {open,high,low,close}} for EQ series, or None if no file (holiday)."""
    url = ARCHIVE.format(ymd=dt.strftime("%Y%m%d"))
    try:
        r = session.get(url, timeout=20)
    except requests.RequestException:
        return None
    if r.status_code != 200 or not r.content:
        return None
    try:
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        name = zf.namelist()[0]
        text = zf.read(name).decode("utf-8", "replace")
    except (zipfile.BadZipFile, IndexError):
        return None

    import csv

    out: dict[str, dict[str, float]] = {}
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        if (row.get("SctySrs") or "").strip() != "EQ":
            continue
        sym = (row.get("TckrSymb") or "").strip().upper()
        if not sym:
            continue
        try:
            out[sym] = {
                "open": float(row["OpnPric"]),
                "high": float(row["HghPric"]),
                "low": float(row["LwPric"]),
                "close": float(row["ClsPric"]),
            }
        except (KeyError, ValueError):
            continue
    return out


def _aggregate_month(days_data: list[tuple[date, dict[str, dict[str, float]]]], symbol: str):
    """Aggregate one symbol's daily bars (ordered oldest->newest) into a monthly bar."""
    bars = [(dt, d[symbol]) for dt, d in days_data if symbol in d]
    if not bars:
        return None
    bars.sort(key=lambda x: x[0])
    o = bars[0][1]["open"]
    c = bars[-1][1]["close"]
    h = max(b[1]["high"] for b in bars)
    l = min(b[1]["low"] for b in bars)
    return {"open": o, "high": h, "low": l, "close": c}


def _period_open(session: requests.Session, year: int, month: int) -> dict[str, float]:
    """Open price of every stock on the first trading day on/after (year, month, 1)."""
    d = date(year, month, 1)
    for _ in range(15):  # skip weekends/holidays until a Bhavcopy exists
        if d.weekday() < 5:
            day = _download_day(session, d)
            if day:
                return {sym: v["open"] for sym, v in day.items()}
        d += timedelta(days=1)
    return {}


def fetch_monthly_ohlc(symbols: list[str], months: int = 2, today: date | None = None) -> dict[str, Any]:
    """Build current + previous month OHLC bars for the requested symbols from Bhavcopy.

    Returns {"data": {SYMBOL: {"months": [prevBar, currBar]}}, "errors": {...},
             "meta": {...}} — matching the contract the frontend expects."""
    wanted = {s.strip().upper() for s in symbols if s and s.strip()}
    today = today or datetime.now().date()
    cy, cm = today.year, today.month
    py, pm = (cy - 1, 12) if cm == 1 else (cy, cm - 1)

    curr_days = _trading_days(cy, cm, upto=today)
    prev_days = _trading_days(py, pm)
    all_days = [("prev", d) for d in prev_days] + [("curr", d) for d in curr_days]

    session = _make_session()

    def fetch(item):
        tag, dt = item
        return (tag, dt, _download_day(session, dt))

    results = list(ThreadPoolExecutor(max_workers=8).map(fetch, all_days))

    curr_data = [(dt, d) for tag, dt, d in results if tag == "curr" and d]
    prev_data = [(dt, d) for tag, dt, d in results if tag == "prev" and d]

    # Calendar period opens for relative-strength ranking (Yearly / Quarterly).
    qtr_start_month = ((cm - 1) // 3) * 3 + 1
    year_open = _period_open(session, cy, 1)
    qtr_open = _period_open(session, cy, qtr_start_month)

    data: dict[str, Any] = {}
    errors: dict[str, str] = {}
    universe = wanted or {
        sym for _dt, d in curr_data + prev_data for sym in d
    }
    for sym in universe:
        cur = _aggregate_month(curr_data, sym)
        pre = _aggregate_month(prev_data, sym)
        if cur is None:
            errors[sym] = "no current-month data"
            continue
        bars = []
        if pre is not None:
            bars.append({"date": date(py, pm, 1).isoformat(), **pre})
        bars.append({"date": date(cy, cm, 1).isoformat(), **cur})
        data[sym] = {
            "months": bars,
            "yearOpen": year_open.get(sym),
            "quarterOpen": qtr_open.get(sym),
        }

    meta = {
        "currentMonthDays": len(curr_data),
        "previousMonthDays": len(prev_data),
        "asOf": today.isoformat(),
        "yearOpenStocks": len(year_open),
        "quarterOpenStocks": len(qtr_open),
        "quarterStartMonth": qtr_start_month,
    }
    return {"data": data, "errors": errors, "meta": meta}
