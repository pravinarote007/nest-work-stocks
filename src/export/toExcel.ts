import * as XLSX from "xlsx";
import { ACTION_COLUMNS, cellValue, RESULT_COLUMNS, RS_COLUMNS, type ColumnDef } from "../components/columns";
import {
  applyRsList,
  combinedRows,
  commonRows,
  LIST_DEFS,
  redCloudOrDtbRows,
  RS_LIST_DEFS,
} from "../engine";
import type { ScreenResult, SummaryRow } from "../engine/types";
import { triggerDownload } from "./toCsv";

function sheetFromRows(rows: SummaryRow[], columns: ColumnDef[]) {
  const aoa: (string | number)[][] = [
    columns.map((c) => c.label),
    ...rows.map((r) => columns.map((c) => cellValue(r, c))),
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

/** Workbook: Stocks in Action (common), Combined (B∪C), Red Cloud/DTB, then A/B/C. */
export function downloadExcel(result: ScreenResult, filename = "HyperScan Signals.xlsx"): void {
  const wb = XLSX.utils.book_new();
  const add = (rows: SummaryRow[], cols: ColumnDef[], name: string) =>
    XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, cols), name.slice(0, 31));

  add(commonRows(result.lists), RESULT_COLUMNS, "Stocks in Action");
  add(redCloudOrDtbRows(result.lists), ACTION_COLUMNS, "Red Cloud - DTB");
  add(combinedRows(result.lists), RESULT_COLUMNS, "Combined (B∪C)");
  for (const def of RS_LIST_DEFS) {
    add(applyRsList(def, result.summary), RS_COLUMNS, def.title);
  }
  for (const def of LIST_DEFS) {
    add(result.lists[def.key], RESULT_COLUMNS, `${def.key} - ${def.title}`);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([out], { type: "application/octet-stream" }), filename);
}
