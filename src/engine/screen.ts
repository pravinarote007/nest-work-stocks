// The three "Bhavik Stocks" filters, transcribed exactly from Bhavik Stocks!A10:C10.
//
//  List A — "RSI Avg Ranking Top-30 Monthly":
//     rsiDiffRank<31 & rsiDiff>0 & retracement>-6 & bullishBORank<61 & greenRangeRank<61
//  List B — "Green Range Bullish Top-60":
//     rsiDiff>0 & retracement>-6 & bullishBORank<61 & greenRangeRank<61
//  List C — "Rise from Low Top-60":
//     rsiDiff>0 & retracement>-6 & riseFromLowRank<61 & greenRangeRank<61
//
// Each list is sorted ascending by Scrip (Excel SORT(FILTER(...)) default).

import type { ListKey, SummaryRow } from "./types";

export interface ListDef {
  key: ListKey;
  title: string;
  criteria: string;
  predicate: (r: SummaryRow) => boolean;
}

export const LIST_DEFS: ListDef[] = [
  {
    key: "A",
    title: "RSI Avg Ranking Top-30 Monthly",
    criteria:
      "RSI-diff rank ≤30, RSI above its avg, within 6% of monthly high, Bullish-BO rank ≤60, Green-Range rank ≤60",
    predicate: (r) =>
      r.rsiDiffRank < 31 &&
      r.rsiDiff > 0 &&
      r.retracement > -6 &&
      r.bullishBORank < 61 &&
      r.greenRangeRank < 61,
  },
  {
    key: "B",
    title: "Green Range Bullish Top-60",
    criteria:
      "RSI above its avg, within 6% of monthly high, Bullish-BO rank ≤60, Green-Range rank ≤60",
    predicate: (r) =>
      r.rsiDiff > 0 && r.retracement > -6 && r.bullishBORank < 61 && r.greenRangeRank < 61,
  },
  {
    key: "C",
    title: "Rise from Low Top-60",
    criteria:
      "RSI above its avg, within 6% of monthly high, Rise-from-Low rank ≤60, Green-Range rank ≤60",
    predicate: (r) =>
      r.rsiDiff > 0 && r.retracement > -6 && r.riseFromLowRank < 61 && r.greenRangeRank < 61,
  },
];

export function applyList(def: ListDef, summary: SummaryRow[]): SummaryRow[] {
  return summary
    .filter(def.predicate)
    .sort((a, b) => a.scrip.localeCompare(b.scrip));
}

// Relative-strength shortlists from the VS Dashboard. Rank cutoff is the Dashboard's
// literal value; note it was tuned for a ~850-stock universe, so over the 211 F&O names
// it is comparatively loose. RSI Avg diff (rsiDiff) must clear -2.
export const RS_RANK_CUTOFF = 151;
export const RS_RSI_MIN = -2;

export interface RsListDef {
  key: string;
  title: string;
  criteria: string;
  predicate: (r: SummaryRow) => boolean;
}

export const RS_LIST_DEFS: RsListDef[] = [
  {
    key: "RSYQ",
    title: "RS Year + Qtr",
    criteria: `Relative strength — Yearly rank < ${RS_RANK_CUTOFF} AND Quarterly rank < ${RS_RANK_CUTOFF} AND RSI Avg diff > ${RS_RSI_MIN}. Ranks over the F&O universe.`,
    predicate: (r) =>
      r.yearRank < RS_RANK_CUTOFF && r.quarterRank < RS_RANK_CUTOFF && r.rsiDiff > RS_RSI_MIN,
  },
  {
    key: "RSYM",
    title: "RS Year + Month",
    criteria: `Relative strength — Yearly rank < ${RS_RANK_CUTOFF} AND Monthly rank < ${RS_RANK_CUTOFF} AND RSI Avg diff > ${RS_RSI_MIN}. Ranks over the F&O universe.`,
    predicate: (r) =>
      r.yearRank < RS_RANK_CUTOFF && r.monthRank < RS_RANK_CUTOFF && r.rsiDiff > RS_RSI_MIN,
  },
];

/** Apply an RS list over the full summary, sorted by yearly rank (best first). */
export function applyRsList(def: RsListDef, summary: SummaryRow[]): SummaryRow[] {
  return summary.filter(def.predicate).sort((a, b) => a.yearRank - b.yearRank);
}

/**
 * Stocks common to all three lists (A ∩ B ∩ C), returned with full detail columns.
 * Rows are taken from list A (the strictest), keeping only those also present in B and C.
 */
export function commonRows(lists: Record<ListKey, SummaryRow[]>): SummaryRow[] {
  const inB = new Set(lists.B.map((r) => r.scrip));
  const inC = new Set(lists.C.map((r) => r.scrip));
  return lists.A.filter((r) => inB.has(r.scrip) && inC.has(r.scrip)).sort((a, b) =>
    a.scrip.localeCompare(b.scrip),
  );
}

/**
 * The combined working list = unique union of lists B and C (de-duplicated).
 * This is the intended "column D" of the Bhavik Stocks sheet (whose formula `=B10:B82`
 * only copied B); it then feeds the detail panel (columns F–X).
 */
export function combinedRows(lists: Record<ListKey, SummaryRow[]>): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const r of [...lists.B, ...lists.C]) if (!map.has(r.scrip)) map.set(r.scrip, r);
  return [...map.values()].sort((a, b) => a.scrip.localeCompare(b.scrip));
}

/**
 * From the combined B∪C list, the stocks with a Red 0.15 cloud OR an active DTB level (>0).
 * Surfaced as the "Red Cloud / DTB" view (detail columns G–X).
 */
export function redCloudOrDtbRows(lists: Record<ListKey, SummaryRow[]>): SummaryRow[] {
  return combinedRows(lists).filter(
    (r) => /red/i.test(r.cloud) || (Number.isFinite(r.dtbLevel) && r.dtbLevel > 0),
  );
}
