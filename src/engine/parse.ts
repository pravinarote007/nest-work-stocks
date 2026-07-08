// CSV parsing: raw file text -> typed engine records (via PapaParse, header mode).
// Each parser is tolerant of stray whitespace and missing/blank numeric cells.

import Papa from "papaparse";
import { plainSymbol } from "./keys";
import type {
  FusionRow,
  Ind015Row,
  Ind120Row,
  OhlcRow,
  RsiRow,
} from "./types";

type Dict = Record<string, string>;

function rows(csv: string): Dict[] {
  const res = Papa.parse<Dict>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return res.data.filter((r) => r && Object.keys(r).length > 0);
}

function num(v: string | undefined): number {
  if (v == null) return Number.NaN;
  const s = String(v).trim().replace(/%/g, "").replace(/,/g, "");
  if (s === "") return Number.NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function parseCurrOhlc(csv: string): OhlcRow[] {
  return rows(csv)
    .filter((r) => r["Scrip"])
    .map((r) => ({
      scrip: plainSymbol(r["Scrip"]),
      lcp: num(r["LCP"]),
      open: num(r["Open"]),
      high: num(r["High"]),
      low: num(r["Low"]),
      close: num(r["Close"]),
    }));
}

export const parsePreOhlc = parseCurrOhlc;

export function parseMrsi(csv: string): RsiRow[] {
  return rows(csv)
    .filter((r) => r["Scrip"])
    .map((r) => ({
      scrip: plainSymbol(r["Scrip"]),
      rsi: num(r["RSI"]),
      rsiAvg: num(r["RSI Avg."] ?? r["RSI Avg"]),
      rsiVsAvg: (r["RSI & Avg"] ?? "").trim(),
      rsiTrend: (r["RSI Trend"] ?? "").trim(),
    }));
}

export function parseInd015(csv: string): Ind015Row[] {
  return rows(csv)
    .filter((r) => r["Scrip"])
    .map((r) => ({
      scrip: plainSymbol(r["Scrip"]),
      l2: num(r["L2"]),
    }));
}

export function parseInd120(csv: string): Ind120Row[] {
  return rows(csv)
    .filter((r) => r["Scrip"])
    .map((r) => ({
      scrip: plainSymbol(r["Scrip"]),
      superTrend: num(r["SuperTrend"]),
    }));
}

// Fusion Matrix has duplicate "0.25%/1%/2%/3%" headers, so the PF-Ranking group is read by
// POSITION (cols 11/12/14 → 0-indexed 10/11/13); the rest by header name.
export function parseFusion(csv: string): FusionRow[] {
  const res = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const grid = res.data.filter((r) => Array.isArray(r) && r.length > 1);
  if (grid.length < 2) return [];
  const header = grid[0].map((h) => String(h ?? "").trim().toLowerCase());
  const at = (name: string) => header.indexOf(name.toLowerCase());
  const iSector = at("sector");
  const iSegment = at("segment");
  const iDtb = at("dtb level");
  const iDbs = at("dbs level");
  const iPctDtb = at("% from dtb");
  const iPctDbs = at("% from dbs");
  const cell = (r: string[], i: number) => (i >= 0 ? r[i] : undefined);
  return grid
    .slice(1)
    .filter((r) => (r[0] ?? "").trim())
    .map((r) => ({
      scrip: plainSymbol(r[0]),
      sector: (cell(r, iSector) ?? "").trim(),
      segment: (cell(r, iSegment) ?? "").trim(),
      dtbLevel: num(cell(r, iDtb)),
      dbsLevel: num(cell(r, iDbs)),
      pctFromDtb: num(cell(r, iPctDtb)),
      pctFromDbs: num(cell(r, iPctDbs)),
      pct025: num(r[10]),
      pct1: num(r[11]),
      pct3: num(r[13]),
    }));
}

/** Used by the uploader to validate that a file was dropped in the correct slot. */
export function headerOf(csv: string): string[] {
  const first = csv.split(/\r?\n/, 1)[0] ?? "";
  return first.split(",").map((h) => h.trim());
}
