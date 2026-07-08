// Shared column definitions for the results tables and the Excel/CSV exporters.
// Each column has a `get(row)` accessor so columns can be direct fields or computed.

import { eqSymbol } from "../engine/keys";
import type { SummaryRow } from "../engine/types";

export interface ColumnDef {
  id: string;
  label: string;
  /** numeric formatting precision; undefined = render as text */
  digits?: number;
  /** color the value green (>=0) / red (<0) */
  signed?: boolean;
  /** render as a colored status pill */
  pill?: "cloud" | "st";
  get: (r: SummaryRow) => string | number;
}

/** Default detail layout used by the Common / A / B / C views. */
export const RESULT_COLUMNS: ColumnDef[] = [
  { id: "scrip", label: "Scrip", get: (r) => r.scrip },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "segment", label: "Segment", get: (r) => r.segment },
  { id: "lcp", label: "LCP", digits: 2, get: (r) => r.lcp },
  { id: "yRank", label: "Y.Rank", digits: 0, get: (r) => (Number.isFinite(r.yearRank) ? r.yearRank : "—") },
  { id: "qRank", label: "Q.Rank", digits: 0, get: (r) => (Number.isFinite(r.quarterRank) ? r.quarterRank : "—") },
  { id: "mRank", label: "M.Rank", digits: 0, get: (r) => (Number.isFinite(r.monthRank) ? r.monthRank : "—") },
  { id: "rsi", label: "RSI", digits: 2, get: (r) => r.rsi },
  { id: "rsiAvg", label: "RSI Avg", digits: 2, get: (r) => r.rsiAvg },
  { id: "rsiDiff", label: "RSI Diff %", digits: 2, signed: true, get: (r) => r.rsiDiff },
  { id: "rsiDiffRank", label: "RSI Diff Rank", digits: 0, get: (r) => r.rsiDiffRank },
  { id: "greenRange", label: "Green Range %", digits: 2, signed: true, get: (r) => r.greenRange },
  { id: "greenRangeRank", label: "GR Rank", digits: 0, get: (r) => r.greenRangeRank },
  { id: "retracement", label: "Retr. from High %", digits: 2, signed: true, get: (r) => r.retracement },
  { id: "riseFromLow", label: "Rise from Low %", digits: 2, signed: true, get: (r) => r.riseFromLow },
  { id: "riseFromLowRank", label: "RfL Rank", digits: 0, get: (r) => r.riseFromLowRank },
  { id: "bullishBO", label: "Bullish BO %", digits: 2, signed: true, get: (r) => r.bullishBO },
  { id: "bullishBORank", label: "BO Rank", digits: 0, get: (r) => r.bullishBORank },
  { id: "cloud", label: "0.15 Cloud", pill: "cloud", get: (r) => r.cloud },
  { id: "dtbLevel", label: "DTB Level", digits: 2, get: (r) => r.dtbLevel },
  { id: "st120", label: "120 ST", pill: "st", get: (r) => r.st120 },
  { id: "st120Pct", label: "120 ST %", digits: 2, signed: true, get: (r) => r.st120Pct },
];

// The Bhavik Stocks detail panel, columns G–X (used by the "Red Cloud / DTB" view).
// Y/Q/M ranks (P/Q/R) come from an external ranking workbook not in the daily files,
// so they are shown as "—".
export const ACTION_COLUMNS: ColumnDef[] = [
  { id: "scripEq", label: "Scrip", get: (r) => eqSymbol(r.scrip) },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "segment", label: "Segment", get: (r) => r.segment },
  { id: "cloud", label: "0.15 Cloud", pill: "cloud", get: (r) => r.cloud },
  { id: "cloudPct", label: "0.15 Cloud %", digits: 2, signed: true, get: (r) => r.cloudPct },
  { id: "dtbLevel", label: "DTB Level", digits: 2, get: (r) => r.dtbLevel },
  { id: "dtbPct", label: "% DTB Level", digits: 2, signed: true, get: (r) => r.dtbPct },
  { id: "st120", label: "120ST Cloud", pill: "st", get: (r) => r.st120 },
  { id: "st120Pct", label: "120ST Cloud %", digits: 2, signed: true, get: (r) => r.st120Pct },
  { id: "yRank", label: "Y.Rank", digits: 0, get: (r) => (Number.isFinite(r.yearRank) ? r.yearRank : "—") },
  { id: "qRank", label: "Q.Rank", digits: 0, get: (r) => (Number.isFinite(r.quarterRank) ? r.quarterRank : "—") },
  { id: "mRank", label: "M.Rank", digits: 0, get: (r) => (Number.isFinite(r.monthRank) ? r.monthRank : "—") },
  { id: "mrsi", label: "MRSI value", digits: 2, get: (r) => r.rsi },
  { id: "grRank", label: "M Green Range", digits: 0, get: (r) => r.greenRangeRank },
  { id: "reRank", label: "M Retr. from High", digits: 0, get: (r) => r.retracementRank },
  { id: "rlRank", label: "M Rise From Low", digits: 0, get: (r) => r.riseFromLowRank },
  { id: "boRank", label: "M Bullish BO", digits: 0, get: (r) => r.bullishBORank },
  { id: "retr", label: "Retr. from High %", digits: 2, signed: true, get: (r) => r.retracement },
];

// Relative-strength view: identity + period performance and ranks.
export const RS_COLUMNS: ColumnDef[] = [
  { id: "scrip", label: "Scrip", get: (r) => r.scrip },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "segment", label: "Segment", get: (r) => r.segment },
  { id: "lcp", label: "LCP", digits: 2, get: (r) => r.lcp },
  { id: "yearlyPerf", label: "Yearly %", digits: 2, signed: true, get: (r) => r.yearlyPerf },
  { id: "yRank", label: "Y.Rank", digits: 0, get: (r) => (Number.isFinite(r.yearRank) ? r.yearRank : "—") },
  { id: "quarterlyPerf", label: "Qtr %", digits: 2, signed: true, get: (r) => r.quarterlyPerf },
  { id: "qRank", label: "Q.Rank", digits: 0, get: (r) => (Number.isFinite(r.quarterRank) ? r.quarterRank : "—") },
  { id: "greenRange", label: "Monthly %", digits: 2, signed: true, get: (r) => r.greenRange },
  { id: "mRank", label: "M.Rank", digits: 0, get: (r) => (Number.isFinite(r.monthRank) ? r.monthRank : "—") },
  { id: "rsiDiff", label: "RSI Avg diff %", digits: 2, signed: true, get: (r) => r.rsiDiff },
  { id: "cloud", label: "0.15 Cloud", pill: "cloud", get: (r) => r.cloud },
  { id: "st120", label: "120 ST", pill: "st", get: (r) => r.st120 },
];

// The full "Summary STudy" joined table (mirrors the workbook sheet).
export const SUMMARY_COLUMNS: ColumnDef[] = [
  { id: "scrip", label: "Scrip", get: (r) => r.scrip },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "segment", label: "Segment", get: (r) => r.segment },
  { id: "lcp", label: "LCP", digits: 2, get: (r) => r.lcp },
  { id: "rsiAvg", label: "RSI Avg", digits: 2, get: (r) => r.rsiAvg },
  { id: "rsiDiff", label: "RSI Avg diff %", digits: 2, signed: true, get: (r) => r.rsiDiff },
  { id: "rsi", label: "RSI Value", digits: 2, get: (r) => r.rsi },
  { id: "rsiDiffRank", label: "Ranking RSI diff", digits: 0, get: (r) => r.rsiDiffRank },
  { id: "rsiValueRank", label: "Ranking RSI Value", digits: 0, get: (r) => r.rsiValueRank },
  { id: "greenRange", label: "Green Range %", digits: 2, signed: true, get: (r) => r.greenRange },
  { id: "retracement", label: "Retracement from High %", digits: 2, signed: true, get: (r) => r.retracement },
  { id: "riseFromLow", label: "Rise From Low %", digits: 2, signed: true, get: (r) => r.riseFromLow },
  { id: "bullishBO", label: "Bullish BO %", digits: 2, signed: true, get: (r) => r.bullishBO },
  { id: "greenRangeRank", label: "Rank Green Range", digits: 0, get: (r) => r.greenRangeRank },
  { id: "retracementRank", label: "Rank Retracement", digits: 0, get: (r) => r.retracementRank },
  { id: "riseFromLowRank", label: "Rank Rise From Low", digits: 0, get: (r) => r.riseFromLowRank },
  { id: "bullishBORank", label: "Rank Bullish BO", digits: 0, get: (r) => r.bullishBORank },
  { id: "cloud", label: "Cloud", pill: "cloud", get: (r) => r.cloud },
  { id: "cloudPct", label: "Cloud %", digits: 2, signed: true, get: (r) => r.cloudPct },
  { id: "st120", label: "ST 120", pill: "st", get: (r) => r.st120 },
  { id: "st120Pct", label: "ST 120 %", digits: 2, signed: true, get: (r) => r.st120Pct },
  { id: "pct025", label: "0.25%", digits: 2, get: (r) => r.pct025 },
  { id: "pct1", label: "1%", digits: 2, get: (r) => r.pct1 },
  { id: "pct3", label: "3%", digits: 2, get: (r) => r.pct3 },
  { id: "dtbLevel", label: "DTB Level", digits: 2, get: (r) => r.dtbLevel },
  { id: "dbsLevel", label: "DBS Level", digits: 2, get: (r) => r.dbsLevel },
  { id: "pctFromDtb", label: "% From DTB", digits: 2, signed: true, get: (r) => r.pctFromDtb },
  { id: "pctFromDbs", label: "% From DBS", digits: 2, signed: true, get: (r) => r.pctFromDbs },
  { id: "yRank", label: "Yearly Ranking", digits: 0, get: (r) => (Number.isFinite(r.yearRank) ? r.yearRank : "—") },
  { id: "qRank", label: "Quarterly Ranking", digits: 0, get: (r) => (Number.isFinite(r.quarterRank) ? r.quarterRank : "—") },
  { id: "mRank", label: "Monthly Ranking", digits: 0, get: (r) => (Number.isFinite(r.monthRank) ? r.monthRank : "—") },
];

export function cellText(row: SummaryRow, col: ColumnDef): string {
  const v = col.get(row);
  if (col.digits == null) return v == null ? "" : String(v);
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(col.digits) : typeof v === "string" ? v : "";
}

/** Raw value for export (numbers stay numbers so Excel sorts/filters correctly). */
export function cellValue(row: SummaryRow, col: ColumnDef): string | number {
  const v = col.get(row);
  if (col.digits == null) return v == null ? "" : v;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(col.digits)) : typeof v === "string" ? v : "";
}
