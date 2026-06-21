// Excel RANK.EQ equivalent.
//
// RANK.EQ(value, range) with the default order (0 = descending): the largest value gets
// rank 1; tied values share the same (best) rank and the next distinct value skips ranks.
// Formally: rank(v) = 1 + count(x in range : x > v).

/** Return ranks (1-based, descending, ties share) parallel to the input values. */
export function rankDescending(values: number[]): number[] {
  return values.map((v) => {
    if (!Number.isFinite(v)) return Number.NaN;
    let greater = 0;
    for (const x of values) {
      if (Number.isFinite(x) && x > v) greater++;
    }
    return greater + 1;
  });
}

/**
 * Attach a descending rank to each row based on `select(row)`.
 * Returns a Map from row reference to its rank.
 */
export function rankRowsBy<T>(rows: T[], select: (r: T) => number): Map<T, number> {
  const ranks = rankDescending(rows.map(select));
  const m = new Map<T, number>();
  rows.forEach((r, i) => m.set(r, ranks[i]));
  return m;
}
