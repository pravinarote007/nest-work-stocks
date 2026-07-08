// Build the joined "Summary STudy" table: one row per stock, all metrics + ranks + detail.

import { computeMetrics } from "./metrics";
import { indexByPlain, plainSymbol } from "./keys";
import { rankRowsBy } from "./rank";
import { MISSING, type EngineInputs, type SummaryRow } from "./types";

export function buildSummary(inputs: EngineInputs): SummaryRow[] {
  const { curr, pre, rsi, ind015, ind120, fusion } = inputs;

  const currBy = indexByPlain(curr);
  const preBy = indexByPlain(pre);
  const rsiBy = indexByPlain(rsi);
  const i015By = indexByPlain(ind015);
  const i120By = indexByPlain(ind120);
  const fusBy = indexByPlain(fusion);

  // Universe = the F&O Fusion Matrix stock list (the authoritative daily F&O set), limited
  // to names that actually have a current OHLC bar (this drops index rows like "NIFTY 50"
  // that carry no equity OHLC). Falls back to the OHLC universe if no Fusion file is given.
  const universe: string[] = fusion.length
    ? [...new Set(fusion.map((f) => plainSymbol(f.scrip)))].filter((s) => currBy.has(s))
    : curr.map((c) => plainSymbol(c.scrip));

  const rows: SummaryRow[] = universe.map((sym) => {
    const c = currBy.get(sym)!;
    const prev = preBy.get(sym);
    const m = computeMetrics(c, prev);
    const yearlyPerf =
      c.yearOpen && Number.isFinite(c.yearOpen) ? ((c.lcp - c.yearOpen) / c.yearOpen) * 100 : MISSING;
    const quarterlyPerf =
      c.quarterOpen && Number.isFinite(c.quarterOpen)
        ? ((c.lcp - c.quarterOpen) / c.quarterOpen) * 100
        : MISSING;
    // Monthly perf from the month open; falls back to green range (= monthly perf when the
    // aggregation period is itself monthly, e.g. F&O).
    const monthlyPerf =
      c.monthOpen && Number.isFinite(c.monthOpen) ? ((c.lcp - c.monthOpen) / c.monthOpen) * 100 : m.greenRange;
    const r = rsiBy.get(sym);
    const rsiVal = r?.rsi ?? Number.NaN;
    const rsiAvg = r?.rsiAvg ?? Number.NaN;
    const rsiDiff =
      Number.isFinite(rsiVal) && Number.isFinite(rsiAvg) && rsiAvg !== 0
        ? ((rsiVal - rsiAvg) / rsiAvg) * 100
        : MISSING;
    const f = fusBy.get(sym);
    const i015 = i015By.get(sym);
    const i120 = i120By.get(sym);

    // Detail columns derived from a single LTP (= current month close), matching the
    // workbook's IndicatorValueTable sheets.
    const ltp = c.lcp;
    const l2 = i015?.l2;
    const st = i120?.superTrend;
    const dtb = f?.dtbLevel;
    const cloud = l2 == null || !Number.isFinite(l2) ? "" : ltp > l2 ? "Green Cloud" : "Red Cloud";
    const cloudPct = l2 ? ((ltp - l2) / l2) * 100 : Number.NaN;
    const st120 = st == null || !Number.isFinite(st) ? "" : ltp > st ? "Above ST" : "Below ST";
    const st120Pct = st ? ((ltp - st) / st) * 100 : Number.NaN;
    const dtbPct = dtb ? ((ltp - dtb) / dtb) * 100 : Number.NaN;

    return {
      scrip: sym,
      rsi: rsiVal,
      rsiAvg,
      rsiDiff,
      rsiDiffRank: Number.NaN, // filled below
      rsiValueRank: Number.NaN,
      rsiVsAvg: r?.rsiVsAvg ?? "",
      rsiTrend: r?.rsiTrend ?? "",
      greenRange: m.greenRange,
      retracement: m.retracement,
      riseFromLow: m.riseFromLow,
      bullishBO: m.bullishBO,
      greenRangeRank: Number.NaN,
      retracementRank: Number.NaN,
      riseFromLowRank: Number.NaN,
      bullishBORank: Number.NaN,
      yearlyPerf,
      quarterlyPerf,
      monthlyPerf,
      yearRank: Number.NaN,
      quarterRank: Number.NaN,
      monthRank: Number.NaN,
      sector: f?.sector ?? "",
      segment: f?.segment ?? "",
      cloud,
      cloudPct,
      dtbLevel: dtb ?? Number.NaN,
      dtbPct,
      st120,
      st120Pct,
      lcp: c.lcp,
    };
  });

  // Ranks across the full universe (RANK.EQ descending, ties share).
  const grRank = rankRowsBy(rows, (r) => r.greenRange);
  const reRank = rankRowsBy(rows, (r) => r.retracement);
  const rlRank = rankRowsBy(rows, (r) => r.riseFromLow);
  const boRank = rankRowsBy(rows, (r) => r.bullishBO);
  const rvRank = rankRowsBy(rows, (r) => r.rsi);
  // RSI-diff rank only over positive diffs (the "Positive Ranking RSI Diff" column).
  const rdRank = rankRowsBy(rows, (r) => (r.rsiDiff > 0 ? r.rsiDiff : Number.NaN));
  // Relative-strength ranks: rank % performance from period open (NaN where no open data).
  const yRank = rankRowsBy(rows, (r) => (r.yearlyPerf > MISSING ? r.yearlyPerf : Number.NaN));
  const qRank = rankRowsBy(rows, (r) => (r.quarterlyPerf > MISSING ? r.quarterlyPerf : Number.NaN));
  const mRank = rankRowsBy(rows, (r) => (r.monthlyPerf > MISSING ? r.monthlyPerf : Number.NaN));

  for (const row of rows) {
    row.greenRangeRank = grRank.get(row)!;
    row.retracementRank = reRank.get(row)!;
    row.riseFromLowRank = rlRank.get(row)!;
    row.bullishBORank = boRank.get(row)!;
    row.rsiValueRank = rvRank.get(row)!;
    row.rsiDiffRank = rdRank.get(row)!;
    row.yearRank = yRank.get(row)!;
    row.quarterRank = qRank.get(row)!;
    row.monthRank = mRank.get(row)!;
  }

  return rows;
}
