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


def _agg_bars(bars: list[dict[str, float]]):
    """Aggregate a symbol's daily bars (oldest->newest) into one OHLC bar."""
    if not bars:
        return None
    return {
        "open": bars[0]["open"],
        "close": bars[-1]["close"],
        "high": max(b["high"] for b in bars),
        "low": min(b["low"] for b in bars),
    }


# A split/bonus shows as a large, clean overnight gap (open vs prior close). NSE F&O large
# caps almost never gap this far without a corporate action, so we treat it as one.
_SPLIT_LOW = 0.72   # ~>28% down  (e.g. 1:2 bonus -> x0.667)
_SPLIT_HIGH = 1.40  # ~>40% up    (reverse split / consolidation)


def _detect_splits(series: list[tuple[date, dict[str, float]]]) -> list[tuple[date, float]]:
    """Return [(event_date, factor)]: prices strictly BEFORE event_date must be multiplied
    by `factor` to sit on the post-event (current) price scale."""
    events: list[tuple[date, float]] = []
    for i in range(1, len(series)):
        prev_close = series[i - 1][1]["close"]
        open_ = series[i][1]["open"]
        if prev_close > 0 and open_ > 0:
            r = open_ / prev_close
            if r < _SPLIT_LOW or r > _SPLIT_HIGH:
                events.append((series[i][0], r))
    return events


def _adjust_series(series: list[tuple[date, dict[str, float]]]):
    """Back-adjust a daily series for detected splits. Returns (adjusted_series, events,
    period_factor) where period_factor (product of all events) adjusts any price dated
    before the window (the yearly/quarterly opens)."""
    events = _detect_splits(series)
    if not events:
        return series, events, 1.0
    period_factor = 1.0
    for _dt, f in events:
        period_factor *= f
    adjusted: list[tuple[date, dict[str, float]]] = []
    for dt, ohlc in series:
        f = 1.0
        for ed, ef in events:
            if dt < ed:
                f *= ef
        adjusted.append((dt, {k: v * f for k, v in ohlc.items()}) if f != 1.0 else (dt, ohlc))
    return adjusted, events, period_factor


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

    # Per-(tag, date) day maps, in chronological order within each tag.
    prev_days_data = sorted(((dt, d) for tag, dt, d in results if tag == "prev" and d), key=lambda x: x[0])
    curr_days_data = sorted(((dt, d) for tag, dt, d in results if tag == "curr" and d), key=lambda x: x[0])

    # Calendar period opens for relative-strength ranking (Yearly / Quarterly).
    qtr_start_month = ((cm - 1) // 3) * 3 + 1
    year_open = _period_open(session, cy, 1)
    qtr_open = _period_open(session, cy, qtr_start_month)

    data: dict[str, Any] = {}
    errors: dict[str, str] = {}
    splits: dict[str, Any] = {}
    universe = wanted or {sym for _dt, d in prev_days_data + curr_days_data for sym in d}

    for sym in universe:
        # Chronological prev+curr daily series for this symbol, tagged so we can split them
        # back out after adjustment.
        prev_series = [(dt, d[sym]) for dt, d in prev_days_data if sym in d]
        curr_series = [(dt, d[sym]) for dt, d in curr_days_data if sym in d]
        if not curr_series:
            errors[sym] = "no current-month data"
            continue

        n_prev = len(prev_series)
        adjusted, events, period_factor = _adjust_series(prev_series + curr_series)
        pre = _agg_bars([o for _dt, o in adjusted[:n_prev]])
        cur = _agg_bars([o for _dt, o in adjusted[n_prev:]])

        bars = []
        if pre is not None:
            bars.append({"date": date(py, pm, 1).isoformat(), **pre})
        bars.append({"date": date(cy, cm, 1).isoformat(), **cur})
        yo = year_open.get(sym)
        qo = qtr_open.get(sym)
        data[sym] = {
            "months": bars,
            # Period opens predate the window, so apply the full split adjustment.
            "yearOpen": yo * period_factor if yo else None,
            "quarterOpen": qo * period_factor if qo else None,
        }
        if events:
            splits[sym] = [{"date": ed.isoformat(), "factor": round(ef, 4)} for ed, ef in events]

    meta = {
        "currentMonthDays": len(curr_days_data),
        "previousMonthDays": len(prev_days_data),
        "asOf": today.isoformat(),
        "yearOpenStocks": len(year_open),
        "quarterOpenStocks": len(qtr_open),
        "quarterStartMonth": qtr_start_month,
        "splitAdjusted": splits,
    }
    return {"data": data, "errors": errors, "meta": meta}
