// VS Dashboard engine: multi-period (Yearly / Quarterly / Monthly) relative-strength +
// retracement analysis over a broad universe, mirroring the "Summary study" sheet.

import { indexByPlain, plainSymbol } from "./keys";
import { rankRowsBy } from "./rank";
import { MISSING, type FusionRow, type RsiRow } from "./types";

export interface PeriodBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PeriodSet {
  yearly: PeriodBar;
  quarterly: PeriodBar;
  monthly: PeriodBar;
}

export interface VsdRow {
  scrip: string;
  sector: string;
  segment: string;
  lcp: number;
  // % from period open (green range) — drives the "Dashboard" ranking.
  yGreenRange: number;
  qGreenRange: number;
  mGreenRange: number;
  // % from period high (retracement, <= 0).
  yRetracement: number;
  qRetracement: number;
  mRetracement: number;
  // Ranks over the universe (1 = best performer that period).
  yRank: number;
  qRank: number;
  mRank: number;
  // RSI block.
  rsi: number;
  rsiAvg: number;
  rsiDiff: number;
  rsiDiffRank: number;
  crossover: string;
  rsiTrend: string;
}

export interface VsdResult {
  rows: VsdRow[];
}

export interface VsdInputs {
  periods: Record<string, PeriodSet>; // keyed by plain symbol
  rsi: RsiRow[];
  fusion: FusionRow[];
}

function pct(numer: number, denom: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom === 0) return MISSING;
  return ((numer - denom) / denom) * 100;
}

export function buildVsd(inputs: VsdInputs): VsdResult {
  const rsiBy = indexByPlain(inputs.rsi);
  const fusBy = indexByPlain(inputs.fusion);

  // Universe = fusion stocks that have fetched period data.
  const universe = inputs.fusion.length
    ? [...new Set(inputs.fusion.map((f) => plainSymbol(f.scrip)))].filter((s) => inputs.periods[s])
    : Object.keys(inputs.periods);

  const rows: VsdRow[] = universe.map((sym) => {
    const p = inputs.periods[sym];
    const lcp = p.yearly.close; // last close = current price (same across periods)
    const r = rsiBy.get(sym);
    const f = fusBy.get(sym);
    const rsi = r?.rsi ?? Number.NaN;
    const rsiAvg = r?.rsiAvg ?? Number.NaN;
    return {
      scrip: sym,
      sector: f?.sector ?? "",
      segment: f?.segment ?? "",
      lcp,
      yGreenRange: pct(lcp, p.yearly.open),
      qGreenRange: pct(lcp, p.quarterly.open),
      mGreenRange: pct(lcp, p.monthly.open),
      yRetracement: pct(lcp, p.yearly.high),
      qRetracement: pct(lcp, p.quarterly.high),
      mRetracement: pct(lcp, p.monthly.high),
      yRank: Number.NaN,
      qRank: Number.NaN,
      mRank: Number.NaN,
      rsi,
      rsiAvg,
      rsiDiff:
        Number.isFinite(rsi) && Number.isFinite(rsiAvg) && rsiAvg !== 0
          ? ((rsi - rsiAvg) / rsiAvg) * 100
          : MISSING,
      rsiDiffRank: Number.NaN,
      crossover: r?.rsiVsAvg ?? "",
      rsiTrend: r?.rsiTrend ?? "",
    };
  });

  const yr = rankRowsBy(rows, (r) => r.yGreenRange);
  const qr = rankRowsBy(rows, (r) => r.qGreenRange);
  const mr = rankRowsBy(rows, (r) => r.mGreenRange);
  const dr = rankRowsBy(rows, (r) => (r.rsiDiff > 0 ? r.rsiDiff : Number.NaN));
  for (const row of rows) {
    row.yRank = yr.get(row)!;
    row.qRank = qr.get(row)!;
    row.mRank = mr.get(row)!;
    row.rsiDiffRank = dr.get(row)!;
  }

  rows.sort((a, b) => a.scrip.localeCompare(b.scrip));
  return { rows };
}
