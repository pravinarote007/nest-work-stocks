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

export function parseFusion(csv: string): FusionRow[] {
  return rows(csv)
    .filter((r) => r["Scrip"])
    .map((r) => ({
      scrip: plainSymbol(r["Scrip"]),
      sector: (r["Sector"] ?? "").trim(),
      segment: (r["Segment"] ?? "").trim(),
      dtbLevel: num(r["DTB Level"]),
    }));
}

/** Used by the uploader to validate that a file was dropped in the correct slot. */
export function headerOf(csv: string): string[] {
  const first = csv.split(/\r?\n/, 1)[0] ?? "";
  return first.split(",").map((h) => h.trim());
}
