import { cellValue, RESULT_COLUMNS, type ColumnDef } from "../components/columns";
import type { SummaryRow } from "../engine/types";

function escape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function listToCsv(rows: SummaryRow[], columns: ColumnDef[] = RESULT_COLUMNS): string {
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(cellValue(r, c))).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

export function downloadCsv(
  filename: string,
  rows: SummaryRow[],
  columns: ColumnDef[] = RESULT_COLUMNS,
): void {
  const blob = new Blob([listToCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
