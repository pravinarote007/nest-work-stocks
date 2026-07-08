import { describe, expect, it } from "vitest";
import { broadRankMap, type VsdResult } from "../vsd";
import type { SummaryRow } from "../types";

describe("broadRankMap overlay", () => {
  it("maps 750-universe Y/Q/M ranks by scrip", () => {
    const vsd = {
      rows: [
        { scrip: "RELIANCE", yRank: 170, qRank: 191, mRank: 146 },
        { scrip: "ADANIPOWER", yRank: 3, qRank: 6, mRank: 12 },
      ],
    } as unknown as VsdResult;
    const map = broadRankMap(vsd);

    // Simulate F&O summary rows with their own (within-universe) ranks.
    const rows = [
      { scrip: "RELIANCE", yearRank: 40, quarterRank: 45, monthRank: 30 },
      { scrip: "ADANIPOWER", yearRank: 1, quarterRank: 2, monthRank: 3 },
      { scrip: "NOTIN750", yearRank: 5, quarterRank: 6, monthRank: 7 },
    ] as SummaryRow[];

    for (const r of rows) {
      const b = map.get(r.scrip);
      r.yearRank = b ? b.yearRank : Number.NaN;
      r.quarterRank = b ? b.quarterRank : Number.NaN;
      r.monthRank = b ? b.monthRank : Number.NaN;
    }

    expect(rows[0]).toMatchObject({ yearRank: 170, quarterRank: 191, monthRank: 146 });
    expect(rows[1]).toMatchObject({ yearRank: 3, quarterRank: 6, monthRank: 12 });
    expect(Number.isNaN(rows[2].yearRank)).toBe(true); // not in 750 -> "—"
  });
});
