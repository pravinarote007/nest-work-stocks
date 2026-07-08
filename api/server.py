"""FastAPI server: exposes /api/ohlc and (in production) serves the built frontend.

Local dev:   uvicorn server:app --port 8000   (from the api/ directory)
             with VITE_API_BASE=http://localhost:8000 so Vite (5173) calls this.
Production:  the multi-stage Dockerfile builds the SPA into ../dist; this server then
             serves it at "/", so the app and API share one origin (no CORS needed)."""

import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import report_store
from bhavcopy import fetch_ohlc

app = FastAPI(title="HyperScan OHLC API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OhlcRequest(BaseModel):
    symbols: list[str]
    period: str = "monthly"  # 'monthly' (F&O), 'quarterly' (N500) or 'ytd' (VS Dashboard)


@app.post("/api/ohlc")
def ohlc(req: OhlcRequest):
    period = req.period if req.period in ("monthly", "quarterly", "ytd") else "monthly"
    return fetch_ohlc(req.symbols, period)


@app.get("/api/health")
def health():
    return {"ok": True}


# ---- Shared latest report (global to all users; no DB, just one JSON file) ----


class ReportPayload(BaseModel):
    report: Any
    savedAt: int | None = None


@app.get("/api/report")
def get_report(market: str = "default"):
    """The latest shared report for a market, or {"report": null} if none/reset."""
    return report_store.load(market) or {"report": None, "savedAt": None}


@app.put("/api/report")
def put_report(p: ReportPayload, market: str = "default"):
    """Save/replace the shared report for a market (called on generate)."""
    saved_at = p.savedAt or int(time.time() * 1000)
    report_store.save(market, p.report, saved_at)
    return {"savedAt": saved_at}


@app.delete("/api/report")
def delete_report(market: str = "default"):
    """Clear the shared report for a market (reset)."""
    report_store.clear(market)
    return {"ok": True}


# Serve the built SPA at "/" when present (production). Registered last so the API routes
# above take precedence. html=True serves index.html for the root.
_dist = Path(__file__).resolve().parent.parent / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
