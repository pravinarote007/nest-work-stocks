// Orchestrator: inputs -> { summary, lists A/B/C }.

import { applyList, LIST_DEFS } from "./screen";
import { buildSummary } from "./summary";
import type { EngineInputs, ListKey, ScreenResult, SummaryRow } from "./types";

export function runScreen(inputs: EngineInputs): ScreenResult {
  const summary = buildSummary(inputs);
  const lists = {} as Record<ListKey, SummaryRow[]>;
  for (const def of LIST_DEFS) {
    lists[def.key] = applyList(def, summary);
  }
  return { summary, lists };
}

export * from "./types";
export {
  LIST_DEFS,
  commonRows,
  combinedRows,
  redCloudOrDtbRows,
  RS_LIST_DEFS,
  applyRsList,
} from "./screen";
