// Shared latest-report persistence.
//
// Primary: the server (/api/report) so the report is GLOBAL — every visitor sees the same
// latest result. It is replaced on a new generate and removed on reset; no time expiry.
// Fallback: localStorage (used only if the backend is unreachable, e.g. a static-only deploy).

import type { ScreenResult } from "./engine/types";

const KEY = "hyperscan:lastResult:v2";
const API_BASE = (import.meta.env?.VITE_API_BASE ?? "").replace(/\/$/, "");

export interface LoadedReport {
  savedAt: number;
  result: ScreenResult;
}

interface Stored {
  savedAt: number;
  report: ScreenResult;
}

/** Load the shared report from the server; fall back to localStorage. */
export async function loadResult(): Promise<LoadedReport | null> {
  try {
    const res = await fetch(`${API_BASE}/api/report`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { report: ScreenResult | null; savedAt: number | null };
      if (data.report && data.savedAt) {
        return { savedAt: data.savedAt, result: data.report };
      }
      return null; // server reachable but empty (e.g. after reset)
    }
  } catch {
    /* backend unreachable — fall through to localStorage */
  }
  return loadLocal();
}

/** Save the report globally (server) + cache locally. Returns the saved timestamp. */
export async function saveResult(result: ScreenResult): Promise<number> {
  const savedAt = Date.now();
  saveLocal({ savedAt, report: result });
  try {
    await fetch(`${API_BASE}/api/report`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: result, savedAt }),
    });
  } catch {
    /* offline — local cache still holds it */
  }
  return savedAt;
}

/** Clear the shared report for everyone (server) + locally. */
export async function clearResult(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    await fetch(`${API_BASE}/api/report`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

function loadLocal(): LoadedReport | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.savedAt && parsed?.report) {
      return { savedAt: parsed.savedAt, result: parsed.report };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveLocal(s: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota — non-fatal */
  }
}
