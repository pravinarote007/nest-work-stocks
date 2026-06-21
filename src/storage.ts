// Persist the most recent generated report in localStorage.
// Retained until either 24h elapses OR a new report is generated (which overwrites it).

import type { ScreenResult } from "./engine/types";

const KEY = "hyperscan:lastResult:v1";
export const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredReport {
  savedAt: number; // epoch ms
  result: ScreenResult;
}

export interface LoadedReport {
  savedAt: number;
  expiresAt: number;
  result: ScreenResult;
}

export function saveResult(result: ScreenResult): number {
  const savedAt = Date.now();
  try {
    const payload: StoredReport = { savedAt, result };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota or serialization failure — non-fatal; the in-memory result still shows.
  }
  return savedAt;
}

/** Return the stored report if present and still within the 24h TTL; else null (and purge). */
export function loadResult(): LoadedReport | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReport;
    if (!parsed?.savedAt || !parsed?.result) return null;
    const expiresAt = parsed.savedAt + TTL_MS;
    if (Date.now() > expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { savedAt: parsed.savedAt, expiresAt, result: parsed.result };
  } catch {
    return null;
  }
}

export function clearResult(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
