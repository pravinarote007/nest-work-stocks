// Per-stock monthly technical metrics, mirroring the Excel "Curr Monthly OHLC" sheet.
// LTP = current month's close (lcp); PrevMonthHigh comes from the previous month's bar.

import { MISSING, type OhlcRow } from "./types";

function pct(numer: number, denom: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom === 0) return MISSING;
  return ((numer - denom) / denom) * 100;
}

export interface Metrics {
  greenRange: number; // (LTP - Open) / Open * 100
  retracement: number; // (LTP - High) / High * 100   (<= 0)
  riseFromLow: number; // (LTP - Low)  / Low  * 100
  bullishBO: number; // (LTP - PrevMonthHigh) / PrevMonthHigh * 100
}

/** Compute metrics for one stock given its current bar and (optional) previous bar. */
export function computeMetrics(curr: OhlcRow, prev: OhlcRow | undefined): Metrics {
  const ltp = curr.lcp;
  return {
    greenRange: pct(ltp, curr.open),
    retracement: pct(ltp, curr.high),
    riseFromLow: pct(ltp, curr.low),
    bullishBO: prev ? pct(ltp, prev.high) : MISSING,
  };
}
