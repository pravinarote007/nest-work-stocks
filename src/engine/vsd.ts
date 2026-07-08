// VS Dashboard engine: multi-period (Yearly / Quarterly / Monthly) relative-strength +
// retracement analysis over a broad universe, mirroring the "Summary study" sheet.

import { indexByPlain, plainSymbol } from "./keys";
import { rankRowsBy } from "./rank";
import { MISSING, type FusionRow, type Ind015Row, type Ind120Row, type RsiRow } from "./types";

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
  // From the Fusion Matrix.
  dtbLevel: number;
  dbsLevel: number;
  pctFromDtb: number;
  pctFromDbs: number;
  pct025: number;
  pct1: number;
  pct3: number;
  isFno: boolean; // is an F&O stock (from the F&O Bhavcopy)
  // ST = 120 SuperTrend; MAST = 0.25 P&F L2. Cloud = LTP vs level (Green/Red).
  stLevel: number;
  stCloud: string;
  stPct: number;
  mastLevel: number;
  mastCloud: string;
  mastPct: number;
}

export interface VsdResult {
  rows: VsdRow[];
}

export interface BroadRanks {
  yearRank: number;
  quarterRank: number;
  monthRank: number;
}

/** Map scrip -> Yearly/Quarterly/Monthly rank over the Nifty 750 (broad) universe. */
export function broadRankMap(result: VsdResult): Map<string, BroadRanks> {
  const m = new Map<string, BroadRanks>();
  for (const r of result.rows) {
    m.set(r.scrip, { yearRank: r.yRank, quarterRank: r.qRank, monthRank: r.mRank });
  }
  return m;
}

export interface VsdInputs {
  periods: Record<string, PeriodSet>; // keyed by plain symbol
  rsi: RsiRow[];
  fusion: FusionRow[];
  ind015?: Ind015Row[]; // 0.25 P&F (L2 → MAST)
  ind120?: Ind120Row[]; // 120 SuperTrend (→ ST)
  fnoSymbols?: string[]; // F&O stock underlyings to flag
}

function cloud(lcp: number, level: number | undefined): [string, number, number] {
  if (level == null || !Number.isFinite(level) || level === 0) return ["", Number.NaN, Number.NaN];
  return [lcp > level ? "GREEN CLOUD" : "RED CLOUD", level, ((lcp - level) / level) * 100];
}

function pct(numer: number, denom: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom === 0) return MISSING;
  return ((numer - denom) / denom) * 100;
}

export function buildVsd(inputs: VsdInputs): VsdResult {
  const rsiBy = indexByPlain(inputs.rsi);
  const fusBy = indexByPlain(inputs.fusion);
  const i015By = indexByPlain(inputs.ind015 ?? []);
  const i120By = indexByPlain(inputs.ind120 ?? []);
  const fnoSet = new Set((inputs.fnoSymbols ?? []).map((s) => plainSymbol(s)));

  // Universe = fusion stocks that have fetched period data.
  const universe = inputs.fusion.length
    ? [...new Set(inputs.fusion.map((f) => plainSymbol(f.scrip)))].filter((s) => inputs.periods[s])
    : Object.keys(inputs.periods);

  const rows: VsdRow[] = universe.map((sym) => {
    const p = inputs.periods[sym];
    const lcp = p.yearly.close; // last close = current price (same across periods)
    const r = rsiBy.get(sym);
    const f = fusBy.get(sym);
    const [stCloud, stLevel, stPct] = cloud(lcp, i120By.get(sym)?.superTrend);
    const [mastCloud, mastLevel, mastPct] = cloud(lcp, i015By.get(sym)?.l2);
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
      dtbLevel: f?.dtbLevel ?? Number.NaN,
      dbsLevel: f?.dbsLevel ?? Number.NaN,
      pctFromDtb: f?.pctFromDtb ?? Number.NaN,
      pctFromDbs: f?.pctFromDbs ?? Number.NaN,
      pct025: f?.pct025 ?? Number.NaN,
      pct1: f?.pct1 ?? Number.NaN,
      pct3: f?.pct3 ?? Number.NaN,
      isFno: fnoSet.has(sym),
      stLevel,
      stCloud,
      stPct,
      mastLevel,
      mastCloud,
      mastPct,
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
