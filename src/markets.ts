// Market definitions. Add a new market (e.g. N700) by appending one entry here — the
// left-nav, per-market uploads, auto-fetch period, and shared report all follow from it.

import type { SlotSpec } from "./components/FileSlot";

export type Period = "monthly" | "quarterly" | "ytd";
export type ViewMode = "full" | "summary";
export type EngineKind = "screen" | "vsd";

export interface MarketConfig {
  id: string; // storage key + report market id
  label: string; // sidebar + header
  blurb: string;
  period: Period; // OHLC aggregation period
  engine: EngineKind; // "screen" (F&O/N500) or "vsd" (multi-period dashboard)
  cloud: string; // "0.15" | "0.25" — P&F cloud box (label only)
  views: ViewMode; // which result views to show (screen engine only)
  scanner: SlotSpec[]; // cloud / 120ST / fusion uploads
  rsi: SlotSpec; // MRSI upload
  ohlcFallback: SlotSpec[]; // manual OHLC upload (curr, pre)
}

function scannerSlots(cloud: string, suffix: string): SlotSpec[] {
  return [
    {
      id: "ind015",
      name: `${cloud} P&F Indicator`,
      hint: `IndicatorValueTable ${cloud}${cloud === "0.15" ? " 1min" : " 1MIN"} ${suffix}.csv`,
      expectHeaderIncludes: ["l2", "dtb"],
    },
    {
      id: "ind120",
      name: "120 SuperTrend",
      hint: `IndicatorValueTable 120ST ${suffix}.csv`,
      expectHeaderIncludes: ["supertrend"],
    },
    {
      id: "fusion",
      name: "Fusion Matrix",
      hint: `${suffix === "F&O" ? "F&O.csv" : suffix + ".csv"} — sector / segment / DTB level`,
      expectHeaderIncludes: ["sector", "segment"],
    },
  ];
}

function ohlcSlots(period: Period, suffix: string): SlotSpec[] {
  const p = period === "quarterly" ? "Quaterly" : "Monthly";
  return [
    {
      id: "curr",
      name: `Curr ${p} OHLC`,
      hint: `Curr ${p} OHLC ${suffix}.csv`,
      expectHeaderIncludes: ["open", "high", "low", "close"],
    },
    {
      id: "pre",
      name: `Pre ${p} OHLC`,
      hint: `Pre ${p} OHLC ${suffix}.csv`,
      expectHeaderIncludes: ["open", "high", "low", "close"],
    },
  ];
}

const rsiSlot = (suffix: string): SlotSpec => ({
  id: "mrsi",
  name: "MRSI_Digger (RSI source)",
  hint: `MRSI_Digger ${suffix}.csv — exact RSI / RSI Avg from your scanner`,
  expectHeaderIncludes: ["rsi"],
});

export const MARKETS: MarketConfig[] = [
  {
    id: "fno",
    label: "F&O",
    blurb: "NSE F&O · Monthly",
    period: "monthly",
    engine: "screen",
    cloud: "0.15",
    views: "full",
    scanner: scannerSlots("0.15", "F&O"),
    rsi: rsiSlot("F&O"),
    ohlcFallback: ohlcSlots("monthly", "F&O"),
  },
  {
    id: "n500",
    label: "Nifty 500",
    blurb: "Nifty 500 · Quarterly",
    period: "quarterly",
    engine: "screen",
    cloud: "0.25",
    views: "summary",
    scanner: scannerSlots("0.25", "N500"),
    rsi: rsiSlot("N500"),
    ohlcFallback: ohlcSlots("quarterly", "N500"),
  },
  {
    id: "vsd",
    label: "VS Dashboard",
    blurb: "All NSE · Yearly / Qtr / Monthly",
    period: "ytd",
    engine: "vsd",
    cloud: "0.25",
    views: "summary",
    scanner: scannerSlots("0.25", "VSD"),
    rsi: rsiSlot("VSD"),
    ohlcFallback: [], // OHLC is always auto-fetched year-to-date
  },
];
