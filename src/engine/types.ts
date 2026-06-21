// Domain types for the Bhavik Stocks screening engine.
// Each record set corresponds to one source (uploaded CSV or auto-fetched data).

/** A monthly OHLC bar. `lcp` (last/close price) doubles as the live price (LTP). */
export interface OhlcRow {
  /** Plain symbol, e.g. "360ONE" (the -EQ suffix is stripped on ingest). */
  scrip: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Last traded / close price. For the current month this is the live price. */
  lcp: number;
  /** Open of the first trading day of the calendar year (for Yearly RS rank). */
  yearOpen?: number;
  /** Open of the first trading day of the current calendar quarter (for Quarterly RS rank). */
  quarterOpen?: number;
}

/** RSI data, whether uploaded (MRSI_Digger) or computed from monthly closes. */
export interface RsiRow {
  scrip: string; // plain symbol
  rsi: number;
  rsiAvg: number;
  /** Display-only crossover signal, e.g. "Positive", "Negative Fresh Crossover". */
  rsiVsAvg?: string;
  /** Display-only trend label, e.g. "Remained above 50", "Left 70". */
  rsiTrend?: string;
}

// Cloud is derived in the workbook as LTP vs the "L2" level; we carry the raw L2.
/** IndicatorValueTable 0.15 1min: P&F levels. */
export interface Ind015Row {
  scrip: string; // plain symbol
  l2: number; // "L2" level — Cloud = LTP > L2 ? Green : Red
}

/** IndicatorValueTable 120ST: 120-period SuperTrend level. */
export interface Ind120Row {
  scrip: string; // plain symbol
  superTrend: number; // ST = LTP > SuperTrend ? Above : Below
}

/** Fusion Matrix (F&O.csv): sector + segment + DTB level. */
export interface FusionRow {
  scrip: string; // plain symbol
  sector: string;
  segment: string;
  dtbLevel: number; // F&O.csv column 31 "DTB Level"
}

/** Bundle of all inputs fed to the engine. RSI/OHLC may come from upload or auto-fetch. */
export interface EngineInputs {
  curr: OhlcRow[];
  pre: OhlcRow[];
  rsi: RsiRow[];
  ind015: Ind015Row[];
  ind120: Ind120Row[];
  fusion: FusionRow[];
}

/** One fully-joined + computed row, mirroring the Excel "Summary STudy" sheet. */
export interface SummaryRow {
  scrip: string;
  // RSI block
  rsi: number;
  rsiAvg: number;
  rsiDiff: number; // (rsi - rsiAvg) / rsiAvg * 100
  rsiDiffRank: number; // RANK.EQ over positive rsiDiff
  rsiValueRank: number; // RANK.EQ over rsi
  rsiVsAvg: string;
  rsiTrend: string;
  // Monthly OHLC metrics
  greenRange: number;
  retracement: number;
  riseFromLow: number;
  bullishBO: number;
  greenRangeRank: number;
  retracementRank: number;
  riseFromLowRank: number;
  bullishBORank: number;
  // Relative-strength performance (% from period open) + ranks over the F&O universe.
  yearlyPerf: number;
  quarterlyPerf: number;
  yearRank: number;
  quarterRank: number;
  monthRank: number; // = greenRangeRank (monthly perf == green range)
  // Detail columns
  sector: string;
  segment: string;
  cloud: string;
  cloudPct: number;
  dtbLevel: number;
  dtbPct: number;
  st120: string;
  st120Pct: number;
  lcp: number;
}

export type ListKey = "A" | "B" | "C";

export interface ScreenResult {
  summary: SummaryRow[];
  lists: Record<ListKey, SummaryRow[]>;
}

/** Missing-lookup sentinel matching Excel `IFERROR(...,-500)`. */
export const MISSING = -500;
