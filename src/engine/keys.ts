// Scrip key normalization.
//
// The source files key on different forms of the same symbol:
//   - MRSI_Digger, IndicatorValueTable 0.15, Fusion Matrix  -> plain ("360ONE")
//   - Curr/Pre Monthly OHLC, IndicatorValueTable 120ST      -> "-EQ" ("360ONE-EQ")
//   - Yahoo Finance (yfinance)                              -> "360ONE.NS"
//
// Internally we normalize everything to the PLAIN, upper-cased symbol so all joins line up.

/** Strip a trailing "-EQ" (and surrounding whitespace) and upper-case. */
export function plainSymbol(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/-EQ$/, "")
    .replace(/\.NS$/, "");
}

/** Append the "-EQ" suffix used by the OHLC / 120ST tables. */
export function eqSymbol(plain: string): string {
  return `${plainSymbol(plain)}-EQ`;
}

/** Build a Map keyed by the plain symbol for O(1) joins. */
export function indexByPlain<T extends { scrip: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = plainSymbol(r.scrip);
    if (k) m.set(k, r);
  }
  return m;
}
