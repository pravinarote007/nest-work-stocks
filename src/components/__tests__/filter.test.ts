import { describe, expect, it } from "vitest";
import { passesFilter } from "../tableFilter";
import { SUMMARY_COLUMNS } from "../columns";

describe("passesFilter numeric", () => {
  it("operators compare numerically, not as strings", () => {
    expect(passesFilter("10", 10, ">9", true)).toBe(true); // 10 > 9 numerically
    expect(passesFilter("9", 9, ">10", true)).toBe(false);
    expect(passesFilter("100", 100, ">=50", true)).toBe(true);
    expect(passesFilter("5", 5, "<10", true)).toBe(true);
    // bare number = ">=" (at-least threshold), never substring
    expect(passesFilter("1651", 1651, "1600", true)).toBe(true); // 1651 >= 1600
    expect(passesFilter("517", 517, "1600", true)).toBe(false); // 517 < 1600
    expect(passesFilter("54.80", 54.8, "1..60", true)).toBe(true);
    expect(passesFilter("40", 40, "=40", true)).toBe(true); // explicit exact
    expect(passesFilter("41", 41, "=40", true)).toBe(false);
    // % / commas / spaces are ignored on numeric columns
    expect(passesFilter("5.20", 5.2, ">5%", true)).toBe(true);
    expect(passesFilter("1200", 1200, ">1,000", true)).toBe(true);
    expect(passesFilter("40", 40, ">= 30", true)).toBe(true);
    // an unparseable expression never substring-matches a number
    expect(passesFilter("150", 150, "abc", true)).toBe(false);
  });
  it("text columns substring", () => {
    expect(passesFilter("Banks", NaN, "ban", false)).toBe(true);
  });
});

describe("SUMMARY_COLUMNS digits flags", () => {
  it("numeric columns declare digits so they are treated numerically", () => {
    const byId = Object.fromEntries(SUMMARY_COLUMNS.map((c) => [c.id, c]));
    for (const id of ["lcp", "rsiDiff", "greenRange", "greenRangeRank", "yRank", "qRank"]) {
      expect(byId[id]?.digits, `${id} should have digits`).not.toBeUndefined();
    }
    // A rank column returns a number for a normal row and "—" only when missing.
    const yRank = byId["yRank"];
    expect(typeof yRank.get({ yearRank: 42 } as never)).toBe("number");
  });
});
