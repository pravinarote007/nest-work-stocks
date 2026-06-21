# HyperScan — AI-Driven Signal Generation

A web app that reproduces the monthly RSI/momentum screen previously maintained in the
`Master RSI F&O Monthly Digger.xlsx` workbook (its "Bhavik Stocks" sheet). Upload the daily
scanner files (and/or auto-fetch monthly OHLC from NSE Bhavcopy), and it generates the three
ranked signal lists with per-stock detail, viewable on screen and downloadable as Excel/CSV.

## What it does

Three lists are produced (exact criteria transcribed from `Bhavik Stocks!A10:C10`):

| List | Criteria |
|---|---|
| **A — RSI Avg Ranking Top-30 Monthly** | RSI-diff rank ≤30, RSI > its avg, within 6% of monthly high, Bullish-BO rank ≤60, Green-Range rank ≤60 |
| **B — Green Range Bullish Top-60** | RSI > its avg, within 6% of monthly high, Bullish-BO rank ≤60, Green-Range rank ≤60 |
| **C — Rise from Low Top-60** | RSI > its avg, within 6% of monthly high, Rise-from-Low rank ≤60, Green-Range rank ≤60 |

The pipeline mirrors the workbook: parse inputs → compute monthly metrics (Green Range,
Retracement from High, Rise from Low, Bullish Breakout vs prev-month high) → rank each
(`RANK.EQ` descending) → join everything per stock (the "Summary STudy" table) → apply the
three filters. See [`src/engine/`](src/engine/).

## Architecture

- **Frontend** — Vite + React + TypeScript static SPA. All parsing/joining/ranking/filtering
  and Excel/CSV export run in the browser (the dataset is ~220 stocks — milliseconds).
- **Backend** — a thin Python function (`POST /api/ohlc`) that downloads the official **NSE
  Bhavcopy** (daily end-of-day equity files) and aggregates the current + previous month into
  monthly OHLC bars. Needed only because NSE blocks direct browser calls. See [`api/`](api/).

## Data inputs

| Data | Source |
|---|---|
| Monthly OHLC (current + previous month) | **Auto-fetch** from NSE Bhavcopy, or upload `Curr/Pre Monthly OHLC F&O.csv` |
| Monthly RSI + RSI Avg | Upload `MRSI_Digger F&O.csv` (**required** — exact scanner values) |
| 0.15 1min P&F cloud level | Upload `IndicatorValueTable 0.15 1min F&O.csv` |
| 120 SuperTrend | Upload `IndicatorValueTable 120ST F&O.csv` |
| Sector / Segment / DTB level | Upload `F&O.csv` (Fusion Matrix) |

**Recommended everyday flow:** upload the 3 scanner files + `MRSI_Digger`, click
**Auto-fetch OHLC (NSE Bhavcopy)**, then **Generate**. OHLC is the official exchange EOD data;
RSI comes from your scanner's MRSI export — so both are exact.

### Why Bhavcopy (not Yahoo/yfinance)

Bhavcopy is the exchange's own end-of-day file, so values match your data vendor exactly —
verified: the completed-month (e.g. May) OHLC reproduces the `Pre Monthly OHLC` CSV to the
paisa. It's raw/unadjusted (the basis scanners use), uses NSE symbols directly (no ticker
mapping), and avoids the split/dividend-adjustment mismatch that made Yahoo-derived RSI
unreliable. It's daily, so the backend pulls ~2 months of files (~40, threaded, ~2s) and
aggregates: month open = first day's open, high/low = month extremes, close = last day's close.

## One thing to know about exact matches

**Universe defines the ranks.** The old workbook ranked over its *static* tracked universe
(195 names pasted into `Summary STudy` column A). This app ranks over **every stock in the
current OHLC input** (e.g. ~216). Because ranks are relative, borderline names near the top-60
cutoff can shift by a few places versus the old sheet. This is expected, not a bug.

## Saved results

The most recently generated report is stored in the browser's `localStorage`
([`src/storage.ts`](src/storage.ts)) and **auto-restored on reload**. It is retained until
either **24 hours** pass or you **generate a new report** (which overwrites it). A banner shows
the saved/expiry time, with a "Clear saved report" button. Storage is per-browser/device only.

## Run locally

```bash
# 1. Frontend
npm install
npm run dev            # http://localhost:5173

# 2. Backend (separate terminal, from api/)
cd api
python -m pip install -r requirements.txt
python -m uvicorn server:app --port 8000
```

Point the frontend at the backend by creating `.env.local`:

```
VITE_API_BASE=http://localhost:8000
```

(Without a backend you can still use the app fully via the **manual upload** fallback for the
OHLC + MRSI files — no Yahoo needed.)

Tests: `npm test` (engine unit tests + a golden-file check against the CSVs in `Bhavik/`).

## Deploy

### Railway (recommended — one service, frontend + API)

A multi-stage [`Dockerfile`](Dockerfile) builds the SPA (Node) and serves it together with the
FastAPI backend (Python), so the app and `/api/ohlc` share one origin — no `VITE_API_BASE`, no
CORS. [`railway.json`](railway.json) points Railway at the Dockerfile and health-checks
`/api/health`.

1. Push the repo to GitHub.
2. Railway → New Project → Deploy from repo. It detects the Dockerfile and builds.
3. Railway injects `$PORT` automatically; the server binds it. Open the generated URL.

(No env vars needed. To run the image locally: `docker build -t hyperscan . && docker run -p 8000:8000 hyperscan` → http://localhost:8000.)

### Vercel (alternative)

`vercel.json` is included; `api/*.py` deploy as Python serverless functions with
`api/requirements.txt` auto-installed. `/api/ohlc` is same-origin in production.

> **Production caveat:** NSE may block datacenter/cloud IPs, so the Bhavcopy auto-fetch can be
> unreliable from any serverless/cloud host (it's solid locally). The **manual OHLC upload path
> always works** as a fallback. The fetch pulls ~40 daily files (~2s threaded) plus 2 period-open
> days; mind serverless timeouts — Railway (a long-running service) is the safer choice.

## Project layout

```
api/                 Python backend (NSE Bhavcopy)
  ohlc.py            Vercel serverless handler  (POST /api/ohlc)
  server.py          Local/Railway FastAPI server (same endpoint)
  bhavcopy.py        Bhavcopy download + monthly OHLC aggregation
src/engine/          Screening engine (parse, keys, metrics, rank, summary, screen, ohlcClient)
src/components/      React UI (file slots, results tabs/table, columns)
src/export/          Excel + CSV exporters
src/storage.ts       24h localStorage persistence of the last report
```
