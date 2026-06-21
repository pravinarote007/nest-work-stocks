"""FastAPI server: exposes /api/ohlc and (in production) serves the built frontend.

Local dev:   uvicorn server:app --port 8000   (from the api/ directory)
             with VITE_API_BASE=http://localhost:8000 so Vite (5173) calls this.
Production:  the multi-stage Dockerfile builds the SPA into ../dist; this server then
             serves it at "/", so the app and API share one origin (no CORS needed)."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from bhavcopy import fetch_monthly_ohlc

app = FastAPI(title="HyperScan OHLC API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OhlcRequest(BaseModel):
    symbols: list[str]


@app.post("/api/ohlc")
def ohlc(req: OhlcRequest):
    return fetch_monthly_ohlc(req.symbols)


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built SPA at "/" when present (production). Registered last so the API routes
# above take precedence. html=True serves index.html for the root.
_dist = Path(__file__).resolve().parent.parent / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
