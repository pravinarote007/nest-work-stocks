// Auto-fetch path: call POST /api/ohlc (NSE Bhavcopy) and convert the returned monthly
// bars into engine OHLC inputs. RSI is NOT produced here — it comes from the user's
// uploaded MRSI_Digger file (Bhavcopy gives only ~2 months, too short for monthly RSI).

import type { OhlcRow, RsiRow } from "./types";

export interface MonthlyBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
}

export interface OhlcApiResponse {
  data: Record<string, { months: MonthlyBar[]; yearOpen?: number | null; quarterOpen?: number | null }>;
  errors: Record<string, string>;
  meta?: {
    currentMonthDays?: number;
    previousMonthDays?: number;
    asOf?: string;
    quarterStartMonth?: number;
  };
}

export interface FetchedOhlc {
  curr: OhlcRow[];
  pre: OhlcRow[];
  rsi: RsiRow[]; // always [] on the Bhavcopy path; RSI comes from the MRSI upload
  errors: Record<string, string>;
  meta?: OhlcApiResponse["meta"];
}

const API_BASE = (import.meta.env?.VITE_API_BASE ?? "").replace(/\/$/, "");

export async function fetchOhlc(symbols: string[]): Promise<OhlcApiResponse> {
  const res = await fetch(`${API_BASE}/api/ohlc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) {
    throw new Error(`OHLC fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as OhlcApiResponse;
}

function bar(scrip: string, b: MonthlyBar): OhlcRow {
  return {
    scrip,
    open: b.open ?? Number.NaN,
    high: b.high ?? Number.NaN,
    low: b.low ?? Number.NaN,
    close: b.close,
    lcp: b.close,
  };
}

/** Convert an /api/ohlc response into engine OHLC inputs (curr = latest, pre = prior). */
export function toEngineInputs(resp: OhlcApiResponse): FetchedOhlc {
  const curr: OhlcRow[] = [];
  const pre: OhlcRow[] = [];

  for (const [scrip, entry] of Object.entries(resp.data)) {
    const months = entry.months;
    if (!months || months.length === 0) continue;
    const currBar = bar(scrip, months[months.length - 1]);
    currBar.yearOpen = entry.yearOpen ?? undefined;
    currBar.quarterOpen = entry.quarterOpen ?? undefined;
    curr.push(currBar);
    if (months.length >= 2) pre.push(bar(scrip, months[months.length - 2]));
  }

  return { curr, pre, rsi: [], errors: resp.errors ?? {}, meta: resp.meta };
}
