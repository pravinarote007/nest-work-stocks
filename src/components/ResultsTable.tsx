import { useMemo, useState } from "react";
import type { SummaryRow } from "../engine/types";
import { cellText, RESULT_COLUMNS, type ColumnDef } from "./columns";
import { passesFilter } from "./tableFilter";

function renderCell(row: SummaryRow, col: ColumnDef) {
  const text = cellText(row, col);
  if (col.pill === "cloud") {
    const tone = /green/i.test(text) ? "green" : /red/i.test(text) ? "red" : "neutral";
    return text ? <span className={`pill ${tone}`}>{text}</span> : "";
  }
  if (col.pill === "st") {
    const tone = /above/i.test(text) ? "green" : /below/i.test(text) ? "red" : "neutral";
    return text ? <span className={`pill ${tone}`}>{text}</span> : "";
  }
  if (col.digits != null) {
    const n = Number(col.get(row));
    const cls = col.signed && Number.isFinite(n) ? (n >= 0 ? "pos" : "neg") : "";
    return <span className={cls}>{text}</span>;
  }
  return text;
}

export function ResultsTable({
  rows,
  columns = RESULT_COLUMNS,
}: {
  rows: SummaryRow[];
  columns?: ColumnDef[];
}) {
  const [sortId, setSortId] = useState(columns[0].id);
  const [asc, setAsc] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const sortCol = columns.find((c) => c.id === sortId) ?? columns[0];

  const filtered = useMemo(() => {
    const active = columns.filter((c) => filters[c.id]?.trim());
    if (active.length === 0) return rows;
    return rows.filter((r) =>
      active.every((c) => passesFilter(cellText(r, c), Number(c.get(r)), filters[c.id], c.digits != null)),
    );
  }, [rows, columns, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortCol.get(a);
      const bv = sortCol.get(b);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = (Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity);
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return asc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortCol, asc]);

  function toggleSort(id: string) {
    if (id === sortId) setAsc(!asc);
    else {
      setSortId(id);
      setAsc(true);
    }
  }

  const activeFilters = Object.values(filters).some((v) => v?.trim());

  if (rows.length === 0) return <div className="empty">No stocks matched this view.</div>;

  return (
    <>
      <div className="table-meta">
        <span className="muted">
          {sorted.length} of {rows.length} rows{activeFilters ? " (filtered)" : ""}
        </span>
        {activeFilters && (
          <button className="ghost" onClick={() => setFilters({})}>
            Clear filters
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} onClick={() => toggleSort(c.id)}>
                  {c.label}
                  {sortId === c.id ? (asc ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
            <tr className="filter-row">
              {columns.map((c) => (
                <th key={c.id}>
                  <input
                    value={filters[c.id] ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, [c.id]: e.target.value }))}
                    placeholder={c.digits != null ? ">0" : "filter"}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.scrip}>
                {columns.map((c) => (
                  <td key={c.id} className={c.digits != null ? "num" : ""}>
                    {renderCell(r, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
