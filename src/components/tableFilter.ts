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

  if (isNumeric && Number.isFinite(cellNum)) {
    const op = f.match(/^(>=|<=|>|<|=)\s*(-?\d+\.?\d*)$/);
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
    const range = f.match(/^(-?\d+\.?\d*)\s*(?:\.\.|to|-)\s*(-?\d+\.?\d*)$/);
    if (range) {
      const a = parseFloat(range[1]);
      const b = parseFloat(range[2]);
      return cellNum >= Math.min(a, b) && cellNum <= Math.max(a, b);
    }
    const single = f.match(/^-?\d+\.?\d*$/);
    if (single) return cellNum === parseFloat(f);
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
