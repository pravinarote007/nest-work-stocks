// Golden-file check: run the engine on the real Bhavik CSVs (upload path, MRSI from CSV)
// and confirm the three lists reproduce the workbook's "Bhavik Stocks" output.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCurrOhlc,
  parseFusion,
  parseInd015,
  parseInd120,
  parseMrsi,
  parsePreOhlc,
} from "../parse";
import { runScreen } from "../index";

const DIR = resolve(__dirname, "../../../Bhavik");
const read = (f: string) => readFileSync(resolve(DIR, f), "utf8");

// The Bhavik/ sample data is proprietary and not committed; skip this check when absent.
const hasData = existsSync(resolve(DIR, "F&O.csv"));

function buildInputs() {
  return {
    curr: parseCurrOhlc(read("Curr Monthly OHLC F&O.csv")),
    pre: parsePreOhlc(read("Pre Monthly OHLC F&O.csv")),
    rsi: parseMrsi(read("MRSI_Digger F&O.csv")),
    ind015: parseInd015(read("IndicatorValueTable 0.15 1min F&O.csv")),
    ind120: parseInd120(read("IndicatorValueTable 120ST F&O.csv")),
    fusion: parseFusion(read("F&O.csv")),
  };
}

describe.skipIf(!hasData)("golden file: Bhavik Stocks lists", () => {
  it("produces the three lists and includes known members", () => {
    const { summary, lists } = runScreen(buildInputs());

    // Diagnostics (visible with --reporter verbose)
    console.log("universe size:", summary.length);
    console.log("List A:", lists.A.map((r) => r.scrip).join(", "));
    console.log("List B:", lists.B.map((r) => r.scrip).join(", "));
    console.log("List C:", lists.C.map((r) => r.scrip).join(", "));

    expect(summary.length).toBeGreaterThan(150);
    for (const key of ["A", "B", "C"] as const) {
      const syms = lists[key].map((r) => r.scrip);
      expect(syms).toContain("ADANIGREEN");
      expect(syms).toContain("ADANIPORTS");
    }
    // List A is the strictest subset (top-30 RSI), so it should be <= the others.
    expect(lists.A.length).toBeLessThanOrEqual(lists.B.length);
  });
});
