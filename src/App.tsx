import { useEffect, useMemo, useState } from "react";
import { FileSlot, type SlotSpec } from "./components/FileSlot";
import { ResultsView } from "./components/ResultsView";
import { runScreen } from "./engine";
import {
  parseCurrOhlc,
  parseFusion,
  parseInd015,
  parseInd120,
  parseMrsi,
  parsePreOhlc,
} from "./engine/parse";
import { plainSymbol } from "./engine/keys";
import { fetchOhlc, toEngineInputs, type FetchedOhlc } from "./engine/ohlcClient";
import type { EngineInputs, ScreenResult } from "./engine/types";
import { clearResult, loadResult, saveResult, TTL_MS } from "./storage";

const SCANNER_SLOTS: SlotSpec[] = [
  {
    id: "ind015",
    name: "0.15 1min Indicator",
    hint: "IndicatorValueTable 0.15 1min F&O.csv",
    expectHeaderIncludes: ["l2", "dtb"],
  },
  {
    id: "ind120",
    name: "120 SuperTrend",
    hint: "IndicatorValueTable 120ST F&O.csv",
    expectHeaderIncludes: ["supertrend"],
  },
  {
    id: "fusion",
    name: "Fusion Matrix (F&O)",
    hint: "F&O.csv — sector / segment / DTB level",
    expectHeaderIncludes: ["sector", "segment"],
  },
];

const RSI_SLOT: SlotSpec = {
  id: "mrsi",
  name: "MRSI_Digger (RSI source)",
  hint: "MRSI_Digger F&O.csv — exact RSI / RSI Avg from your scanner",
  expectHeaderIncludes: ["rsi"],
};

const OHLC_FALLBACK_SLOTS: SlotSpec[] = [
  {
    id: "curr",
    name: "Curr Monthly OHLC",
    hint: "Curr Monthly OHLC F&O.csv",
    expectHeaderIncludes: ["open", "high", "low", "close"],
  },
  {
    id: "pre",
    name: "Pre Monthly OHLC",
    hint: "Pre Monthly OHLC F&O.csv",
    expectHeaderIncludes: ["open", "high", "low", "close"],
  },
];

const countLines = (text: string) => Math.max(0, text.split(/\r?\n/).filter((l) => l.trim()).length - 1);

export default function App() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState<FetchedOhlc | null>(null);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState<string>("");
  const restored = useMemo(() => loadResult(), []);
  const [result, setResult] = useState<ScreenResult | null>(restored?.result ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);
  const [error, setError] = useState<string>("");
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("hyperscan:theme") as "dark" | "light") || "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("hyperscan:theme", theme);
  }, [theme]);

  const onLoad = (id: string, text: string) => {
    setFiles((f) => ({ ...f, [id]: text }));
    if (id === "curr" || id === "pre" || id === "mrsi") setAuto(null); // manual overrides auto
  };

  // Universe for auto-fetch is taken from whichever scanner file is present.
  const universe = useMemo(() => {
    const src = files.fusion ?? files.ind120 ?? files.ind015;
    if (!src) return [];
    const rows = src.split(/\r?\n/).slice(1);
    const syms = new Set<string>();
    for (const line of rows) {
      const first = line.split(",")[0]?.trim();
      if (first) syms.add(plainSymbol(first));
    }
    return [...syms];
  }, [files.fusion, files.ind120, files.ind015]);

  async function handleAutoFetch() {
    setError("");
    if (universe.length === 0) {
      setError("Upload at least one scanner file (Fusion / 120ST / 0.15) first so I know which symbols to fetch.");
      return;
    }
    setFetching(true);
    setStatus(`Fetching NSE Bhavcopy (current + previous month) for ${universe.length} symbols…`);
    try {
      const resp = await fetchOhlc(universe);
      const inputs = toEngineInputs(resp);
      setAuto(inputs);
      const errCount = Object.keys(inputs.errors).length;
      const asOf = inputs.meta?.asOf ? ` as of ${inputs.meta.asOf}` : "";
      setStatus(
        `Got Bhavcopy OHLC for ${inputs.curr.length} symbols${asOf}` +
          `${errCount ? `, ${errCount} not found (skipped)` : ""}.`,
      );
    } catch (e) {
      setError(`Bhavcopy fetch failed: ${(e as Error).message}. You can upload the OHLC files manually instead.`);
      setStatus("");
    } finally {
      setFetching(false);
    }
  }

  // OHLC: Bhavcopy auto-fetch OR uploaded curr+pre. RSI: always from the MRSI upload.
  const haveOhlc = Boolean(auto || (files.curr && files.pre));
  const haveRsi = Boolean(files.mrsi);
  const canGenerate = haveOhlc && haveRsi;

  function handleGenerate() {
    setError("");
    try {
      const inputs: EngineInputs = {
        curr: auto?.curr ?? (files.curr ? parseCurrOhlc(files.curr) : []),
        pre: auto?.pre ?? (files.pre ? parsePreOhlc(files.pre) : []),
        // RSI always comes from the uploaded MRSI_Digger file (exact scanner values).
        rsi: files.mrsi ? parseMrsi(files.mrsi) : [],
        ind015: files.ind015 ? parseInd015(files.ind015) : [],
        ind120: files.ind120 ? parseInd120(files.ind120) : [],
        fusion: files.fusion ? parseFusion(files.fusion) : [],
      };
      if (inputs.curr.length === 0) {
        setError("No current-month OHLC available. Auto-fetch or upload the Curr Monthly OHLC file.");
        return;
      }
      const res = runScreen(inputs);
      setResult(res);
      setSavedAt(saveResult(res)); // persist; overwrites any prior saved report
      window.scrollTo({ top: 0, behavior: "smooth" }); // results render above the form

    } catch (e) {
      setError(`Failed to generate: ${(e as Error).message}`);
    }
  }

  function handleClearSaved() {
    clearResult();
    setSavedAt(null);
    setResult(null);
  }

  return (
    <>
      <div className="brandbar">
        <div className="brandbar-inner">
          <div className="brand-logo">⚡</div>
          <div>
            <div className="brand-name">Hyper<span>Scan</span></div>
            <div className="brand-tag">AI-Driven Signal Generation</div>
          </div>
          <div className="brand-spacer" />
          <div className="brand-pill">NSE F&amp;O · Monthly</div>
          <button
            className="theme-toggle"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      <div className="app">
      {result && (
        <>
          {savedAt && (
            <div className="prev-banner">
              <span>
                Showing your last scan · saved {new Date(savedAt).toLocaleString()} · auto-expires{" "}
                {new Date(savedAt + TTL_MS).toLocaleString()}.
              </span>
              <button className="ghost" onClick={handleClearSaved}>
                Clear & start fresh
              </button>
            </div>
          )}
          <ResultsView result={result} />
        </>
      )}

      <div className="panel">
        <h2><span className="step">1</span> Scanner files — required for detail columns</h2>
        <div className="row">
          {SCANNER_SLOTS.map((s) => (
            <FileSlot key={s.id} spec={s} onLoad={onLoad} countRows={countLines} filled={!!files[s.id]} />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2><span className="step">2</span> RSI source — required</h2>
        <div className="row">
          <FileSlot spec={RSI_SLOT} onLoad={onLoad} countRows={countLines} filled={!!files.mrsi} />
          <div className="slot" style={{ borderStyle: "solid" }}>
            <div className="name">Why upload this?</div>
            <div className="hint">
              RSI / RSI Avg come straight from your scanner's MRSI_Digger export, so the numbers
              match your screen exactly. (OHLC is fetched separately from NSE Bhavcopy below.)
            </div>
            <div className={`status ${files.mrsi ? "ok" : "err"}`}>
              {files.mrsi ? "RSI loaded ✓" : "Required — upload MRSI_Digger"}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2><span className="step">3</span> Monthly OHLC — NSE Bhavcopy</h2>
        <div className="actions">
          <button onClick={handleAutoFetch} disabled={fetching}>
            {fetching ? "Fetching…" : "Auto-fetch OHLC (NSE Bhavcopy)"}
          </button>
          <span className="muted">
            {universe.length > 0
              ? `${universe.length} symbols detected from scanner files`
              : "Upload a scanner file to detect the symbol universe"}
          </span>
        </div>
        {status && <div className="spinner" style={{ marginTop: 8 }}>{status}</div>}
        {auto && (
          <div className="muted" style={{ marginTop: 6 }}>
            Using official NSE Bhavcopy OHLC for {auto.curr.length} symbols
            {auto.meta?.currentMonthDays != null
              ? ` (${auto.meta.currentMonthDays} trading days this month, ${auto.meta.previousMonthDays} last month).`
              : "."}
          </div>
        )}
        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            Manual OHLC upload (use if NSE is unavailable, or to match a specific snapshot)
          </summary>
          <div className="row" style={{ marginTop: 12 }}>
            {OHLC_FALLBACK_SLOTS.map((s) => (
              <FileSlot key={s.id} spec={s} onLoad={onLoad} countRows={countLines} filled={!!files[s.id]} />
            ))}
          </div>
        </details>
      </div>

      <div className="panel">
        <h2><span className="step">4</span> Generate</h2>
        <div className="actions">
          <button onClick={handleGenerate} disabled={!canGenerate}>
            Generate Signals
          </button>
          {!canGenerate && (
            <span className="muted">
              Need the MRSI_Digger file (step 2) and OHLC (Bhavcopy fetch or manual Curr + Pre upload).
            </span>
          )}
        </div>
        {error && <div className="warnbox">{error}</div>}
      </div>
      </div>
    </>
  );
}
