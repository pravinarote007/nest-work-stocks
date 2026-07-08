// Per-column filter matching for the results tables.
//
// Text columns: case-insensitive substring match on the displayed text.
// Numeric columns: operator (>, <, >=, <=, =) or range ("3..8", "3-8", "3 to 8"); if the
//   filter isn't a numeric expression it falls back to substring on the formatted text.

export function passesFilter(
  cellText: string,
  cellNum: number,
  filter: string,
  isNumeric: boolean,
): boolean {
  const f = filter.trim();
  if (!f) return true;

  if (isNumeric) {
    if (!Number.isFinite(cellNum)) return false; // e.g. "—"/missing rows fail any numeric filter
    // Ignore %, commas and spaces so ">5%", "1,000", ">= 50" all parse numerically.
    const g = f.replace(/[%,\s]/g, "");
    const op = g.match(/^(>=|<=|>|<|=)(-?\d+\.?\d*)$/);
    if (op) {
      const n = parseFloat(op[2]);
      switch (op[1]) {
        case ">":
          return cellNum > n;
        case "<":
          return cellNum < n;
        case ">=":
          return cellNum >= n;
        case "<=":
          return cellNum <= n;
        default:
          return cellNum === n;
      }
    }
    const range = g.match(/^(-?\d+\.?\d*)(?:\.\.|to|-)(-?\d+\.?\d*)$/);
    if (range) {
      const a = parseFloat(range[1]);
      const b = parseFloat(range[2]);
      return cellNum >= Math.min(a, b) && cellNum <= Math.max(a, b);
    }
    const single = g.match(/^-?\d+\.?\d*$/);
    if (single) return cellNum === parseFloat(g);
    return false; // unrecognized numeric expression → no match (never substring on a number)
  }

  return cellText.toLowerCase().includes(f.toLowerCase());
}

/** True if a row passes all active column filters. */
export function rowPasses<C extends { id: string; digits?: number }>(
  columns: C[],
  filters: Record<string, string>,
  textOf: (c: C) => string,
  numOf: (c: C) => number,
): boolean {
  for (const c of columns) {
    const f = filters[c.id];
    if (f && !passesFilter(textOf(c), numOf(c), f, c.digits != null)) return false;
  }
  return true;
}
