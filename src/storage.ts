// Shared latest-report persistence, per market. Result payload is generic (each market's
// engine defines its own shape). No DB — one JSON file per market on the server.
//
// Primary: the server (/api/report?market=ID) so the report is GLOBAL. Fallback: localStorage.

const API_BASE = (import.meta.env?.VITE_API_BASE ?? "").replace(/\/$/, "");
const localKey = (market: string) => `hyperscan:lastResult:v2:${market}`;

export interface LoadedReport<T = unknown> {
  savedAt: number;
  result: T;
}

interface Stored {
  savedAt: number;
  report: unknown;
}

/** Load a market's shared report from the server; fall back to localStorage. */
export async function loadResult<T = unknown>(market: string): Promise<LoadedReport<T> | null> {
  try {
    const res = await fetch(`${API_BASE}/api/report?market=${encodeURIComponent(market)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { report: T | null; savedAt: number | null };
      if (data.report && data.savedAt) {
        return { savedAt: data.savedAt, result: data.report };
      }
      return null; // reachable but empty (e.g. after reset)
    }
  } catch {
    /* backend unreachable */
  }
  return loadLocal<T>(market);
}

/** Save a market's report globally + cache locally. Returns the saved timestamp. */
export async function saveResult(market: string, result: unknown): Promise<number> {
  const savedAt = Date.now();
  saveLocal(market, { savedAt, report: result });
  try {
    await fetch(`${API_BASE}/api/report?market=${encodeURIComponent(market)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: result, savedAt }),
    });
  } catch {
    /* offline */
  }
  return savedAt;
}

/** Clear a market's shared report for everyone + locally. */
export async function clearResult(market: string): Promise<void> {
  try {
    localStorage.removeItem(localKey(market));
  } catch {
    /* ignore */
  }
  try {
    await fetch(`${API_BASE}/api/report?market=${encodeURIComponent(market)}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

function loadLocal<T>(market: string): LoadedReport<T> | null {
  try {
    const raw = localStorage.getItem(localKey(market));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.savedAt && parsed?.report) {
      return { savedAt: parsed.savedAt, result: parsed.report as T };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveLocal(market: string, s: Stored): void {
  try {
    localStorage.setItem(localKey(market), JSON.stringify(s));
  } catch {
    /* quota */
  }
}
