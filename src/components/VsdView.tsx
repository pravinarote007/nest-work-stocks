import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { VsdResult, VsdRow } from "../engine/vsd";
import { triggerDownload } from "../export/toCsv";
import { passesFilter } from "./tableFilter";

interface VCol {
  id: string;
  label: string;
  digits?: number;
  signed?: boolean;
  get: (r: VsdRow) => string | number;
}

const rank = (v: number) => (Number.isFinite(v) ? v : "—");

const SUMMARY_STUDY: VCol[] = [
  { id: "scrip", label: "Scrip", get: (r) => r.scrip },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "segment", label: "Segment", get: (r) => r.segment },
  { id: "lcp", label: "LCP", digits: 2, get: (r) => r.lcp },
  { id: "yRetr", label: "Y Retracement %", digits: 2, signed: true, get: (r) => r.yRetracement },
  { id: "qRetr", label: "Q Retracement %", digits: 2, signed: true, get: (r) => r.qRetracement },
  { id: "mRetr", label: "M Retracement %", digits: 2, signed: true, get: (r) => r.mRetracement },
  { id: "yRank", label: "Dashboard Yearly Rank", digits: 0, get: (r) => rank(r.yRank) },
  { id: "qRank", label: "Dashboard Quarterly Rank", digits: 0, get: (r) => rank(r.qRank) },
  { id: "mRank", label: "Dashboard Monthly Rank", digits: 0, get: (r) => rank(r.mRank) },
  { id: "rsiDiff", label: "M RSI Diff %", digits: 2, signed: true, get: (r) => r.rsiDiff },
  { id: "rsiDiffRank", label: "M RSI Diff Ranking", digits: 0, get: (r) => rank(r.rsiDiffRank) },
  { id: "crossover", label: "Crossover", get: (r) => r.crossover },
];

const YRANK: VCol[] = [
  { id: "scrip", label: "Scrip", get: (r) => r.scrip },
  { id: "sector", label: "Sector", get: (r) => r.sector },
  { id: "lcp", label: "LCP", digits: 2, get: (r) => r.lcp },
  { id: "yPerf", label: "% change open (Yearly)", digits: 2, signed: true, get: (r) => r.yGreenRange },
  { id: "yRank", label: "Live Ranking (Y)", digits: 0, get: (r) => rank(r.yRank) },
  { id: "yRetr", label: "High Retracement %", digits: 2, signed: true, get: (r) => r.yRetracement },
  { id: "qRank", label: "Quarterly Ranking", digits: 0, get: (r) => rank(r.qRank) },
  { id: "mRank", label: "Monthly Ranking", digits: 0, get: (r) => rank(r.mRank) },
  { id: "rsiDiff", label: "RSI Diff %", digits: 2, signed: true, get: (r) => r.rsiDiff },
  { id: "crossover", label: "Crossover", get: (r) => r.crossover },
];

function text(r: VsdRow, c: VCol): string {
  const v = c.get(r);
  if (c.digits == null) return v == null ? "" : String(v);
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(c.digits) : typeof v === "string" ? v : "";
}
function value(r: VsdRow, c: VCol): string | number {
  const v = c.get(r);
  if (c.digits == null) return v == null ? "" : v;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(c.digits)) : typeof v === "string" ? v : "";
}

function VTable({ rows, columns }: { rows: VsdRow[]; columns: VCol[] }) {
  const [sortId, setSortId] = useState(columns[0].id);
  const [asc, setAsc] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const col = columns.find((c) => c.id === sortId) ?? columns[0];

  const filtered = useMemo(() => {
    const active = columns.filter((c) => filters[c.id]?.trim());
    if (active.length === 0) return rows;
    return rows.filter((r) =>
      active.every((c) => passesFilter(text(r, c), Number(c.get(r)), filters[c.id], c.digits != null)),
    );
  }, [rows, columns, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.get(a);
      const bv = col.get(b);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = (Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity);
      } else cmp = String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, col, asc]);

  const activeFilters = Object.values(filters).some((v) => v?.trim());
  if (rows.length === 0) return <div className="empty">No stocks.</div>;
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
              <th
                key={c.id}
                onClick={() => (c.id === sortId ? setAsc(!asc) : (setSortId(c.id), setAsc(true)))}
              >
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
              {columns.map((c) => {
                const t = text(r, c);
                const cls =
                  c.digits != null && c.signed && Number.isFinite(Number(c.get(r)))
                    ? Number(c.get(r)) >= 0
                      ? "pos"
                      : "neg"
                    : "";
                return (
                  <td key={c.id} className={c.digits != null ? "num" : ""}>
                    <span className={cls}>{t}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function toCsv(rows: VsdRow[], columns: VCol[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(value(r, c))).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

function downloadExcel(result: VsdResult) {
  const wb = XLSX.utils.book_new();
  const sheet = (cols: VCol[]) =>
    XLSX.utils.aoa_to_sheet([cols.map((c) => c.label), ...result.rows.map((r) => cols.map((c) => value(r, c)))]);
  XLSX.utils.book_append_sheet(wb, sheet(SUMMARY_STUDY), "Summary study");
  XLSX.utils.book_append_sheet(wb, sheet(YRANK), "Y.Rank");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([out], { type: "application/octet-stream" }), "HyperScan Nifty 750.xlsx");
}

const TABS = [
  { key: "SUMMARY", title: "Summary Study", columns: SUMMARY_STUDY, note: "Y/Q/M retracement from period high + relative-strength rankings + RSI." },
  { key: "YRANK", title: "Y.Rank 01-01-2026", columns: YRANK, note: "Yearly ranking — rank by % performance from the year's open." },
];

export function VsdView({ result }: { result: VsdResult }) {
  const [active, setActive] = useState("SUMMARY");
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  return (
    <div className="panel">
      <h2>Stocks in Action</h2>
      <div className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
        {result.rows.length} stocks ranked across Yearly / Quarterly / Monthly.
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${t.key === active ? "active" : ""}`} onClick={() => setActive(t.key)}>
            {t.title}
            <span className="badge">{result.rows.length}</span>
          </button>
        ))}
      </div>
      <div className="criteria">{tab.note}</div>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="secondary"
          onClick={() =>
            triggerDownload(new Blob([toCsv(result.rows, tab.columns)], { type: "text/csv;charset=utf-8" }), `HyperScan ${tab.key}.csv`)
          }
        >
          Download {tab.key} CSV
        </button>
        <button className="secondary" onClick={() => downloadExcel(result)}>
          Download Excel (both tabs)
        </button>
      </div>
      <VTable rows={result.rows} columns={tab.columns} />
    </div>
  );
}
