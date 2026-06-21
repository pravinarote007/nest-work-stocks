import { describe, expect, it } from "vitest";
import { rankDescending } from "../rank";
import { computeMetrics } from "../metrics";
import { runScreen } from "../index";
import type { EngineInputs, OhlcRow } from "../types";

describe("rankDescending (RANK.EQ)", () => {
  it("largest gets rank 1; ties share rank; next skips", () => {
    expect(rankDescending([10, 30, 20])).toEqual([3, 1, 2]);
    expect(rankDescending([5, 5, 1])).toEqual([1, 1, 3]);
  });
});

describe("computeMetrics", () => {
  it("computes the four monthly metrics from LTP", () => {
    const curr: OhlcRow = { scrip: "X", open: 100, high: 120, low: 90, close: 110, lcp: 110 };
    const prev: OhlcRow = { scrip: "X", open: 80, high: 105, low: 70, close: 100, lcp: 100 };
    const m = computeMetrics(curr, prev);
    expect(m.greenRange).toBeCloseTo(10); // (110-100)/100
    expect(m.retracement).toBeCloseTo((-10 / 120) * 100); // below high
    expect(m.riseFromLow).toBeCloseTo((20 / 90) * 100);
    expect(m.bullishBO).toBeCloseTo((5 / 105) * 100); // vs prev high
  });
});

describe("runScreen filters", () => {
  it("applies the three list predicates", () => {
    // GOODSTK: strong everything -> should appear in all lists.
    // WEAKSTK: retraced hard from high -> excluded everywhere.
    const ohlc = (scrip: string, o: number, h: number, l: number, c: number): OhlcRow => ({
      scrip,
      open: o,
      high: h,
      low: l,
      close: c,
      lcp: c,
    });
    const inputs: EngineInputs = {
      curr: [ohlc("GOODSTK", 100, 112, 95, 111), ohlc("WEAKSTK", 100, 140, 95, 100)],
      pre: [ohlc("GOODSTK", 90, 105, 85, 100), ohlc("WEAKSTK", 90, 105, 85, 100)],
      rsi: [
        { scrip: "GOODSTK", rsi: 65, rsiAvg: 55 }, // rsiDiff > 0
        { scrip: "WEAKSTK", rsi: 45, rsiAvg: 55 }, // rsiDiff < 0
      ],
      ind015: [],
      ind120: [],
      fusion: [],
    };
    const { lists } = runScreen(inputs);
    for (const k of ["A", "B", "C"] as const) {
      expect(lists[k].map((r) => r.scrip)).toContain("GOODSTK");
      expect(lists[k].map((r) => r.scrip)).not.toContain("WEAKSTK");
    }
  });
});
