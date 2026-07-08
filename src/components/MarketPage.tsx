import { useEffect, useMemo, useState } from "react";
import { FileSlot } from "./FileSlot";
import { ResultsView } from "./ResultsView";
import { VsdView } from "./VsdView";
import { runScreen } from "../engine";
import { buildVsd, type VsdResult } from "../engine/vsd";
import { parseCurrOhlc, parseFusion, parseInd015, parseInd120, parseMrsi, parsePreOhlc } from "../engine/parse";
import { plainSymbol } from "../engine/keys";
import { fetchOhlc, toEngineInputs, toPeriods, type OhlcApiResponse } from "../engine/ohlcClient";
import type { EngineInputs, ScreenResult } from "../engine/types";
import { clearResult, loadResult, saveResult } from "../storage";
import type { MarketConfig } from "../markets";

type AnyResult = ScreenResult | VsdResult;
const countLines = (t: string) => Math.max(0, t.split(/\r?\n/).filter((l) => l.trim()).length - 1);
const periodWord = (m: MarketConfig) =>
  m.period === "quarterly" ? "quarterly" : m.period === "ytd" ? "year-to-date" : "monthly";
const PeriodWord = (m: MarketConfig) =>
  m.period === "quarterly" ? "Quarterly" : m.period === "ytd" ? "Year-to-date" : "Monthly";

export function MarketPage({ market }: { market: MarketConfig }) {
  const isVsd = market.engine === "vsd";
  const [files, setFiles] = useState<Record<string, string>>({});
  const [autoResp, setAutoResp] = useState<OhlcApiResponse | null>(null);
  const [autoCount, setAutoCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<AnyResult | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void loadResult<AnyResult>(market.id).then((r) => {
      if (alive && r) {
        setResult(r.result);
        setSavedAt(r.savedAt);
      }
    });
    return () => {
      alive = false;
    };
  }, [market.id]);

  const onLoad = (id: string, text: string) => {
    setFiles((f) => ({ ...f, [id]: text }));
    // Manual OHLC upload overrides the auto-fetch; other uploads leave it alone.
    if (id === "curr" || id === "pre") setAutoResp(null);
    // Keep the current (shared) results on screen while new files are staged; they are
    // replaced only when a new scan is generated (or cleared via Reset).
  };

  const universe = useMemo(() => {
    const src = files.fusion ?? files.ind120 ?? files.ind015;
    if (!src) return [];
    const syms = new Set<string>();
    for (const line of src.split(/\r?\n/).slice(1)) {
      const first = line.split(",")[0]?.trim();
      if (first) syms.add(plainSymbol(first));
    }
    return [...syms];
  }, [files.fusion, files.ind120, files.ind015]);

  async function handleAutoFetch() {
    setError("");
    if (universe.length === 0) {
      setError("Upload a scanner file (Fusion / 120ST / cloud) first so I know which symbols to fetch.");
      return;
    }
    setFetching(true);
    setStatus(`Fetching NSE Bhavcopy (${periodWord(market)}) for ${universe.length} symbols…`);
    try {
      const resp = await fetchOhlc(universe, market.period);
      setAutoResp(resp);
      const n = Object.keys(resp.data).length;
      setAutoCount(n);
      const errCount = Object.keys(resp.errors).length;
      const asOf = resp.meta?.asOf ? ` as of ${resp.meta.asOf}` : "";
      setStatus(`Got Bhavcopy OHLC for ${n} symbols${asOf}${errCount ? `, ${errCount} not found (skipped)` : ""}.`);
    } catch (e) {
      setError(`Bhavcopy fetch failed: ${(e as Error).message}. ${isVsd ? "" : "You can upload the OHLC files manually instead."}`);
      setStatus("");
    } finally {
      setFetching(false);
    }
  }

  const respHas = (pred: (d: OhlcApiResponse["data"][string]) => boolean) =>
    Boolean(autoResp && Object.values(autoResp.data).some(pred));
  const haveOhlc = isVsd
    ? respHas((d) => !!d.periods)
    : respHas((d) => !!d.months) || Boolean(files.curr && files.pre);
  const canGenerate = isVsd
    ? haveOhlc && Boolean(files.mrsi && files.fusion)
    : haveOhlc && Boolean(files.mrsi);

  function handleGenerate() {
    setError("");
    try {
      let res: AnyResult;
      if (isVsd) {
        res = buildVsd({
          periods: toPeriods(autoResp!),
          rsi: files.mrsi ? parseMrsi(files.mrsi) : [],
          fusion: files.fusion ? parseFusion(files.fusion) : [],
        });
        if ((res as VsdResult).rows.length === 0) {
          setError("No stocks to rank — check the Fusion file and that the OHLC fetch succeeded.");
          return;
        }
      } else {
        const fetched = autoResp ? toEngineInputs(autoResp) : null;
        const inputs: EngineInputs = {
          curr: fetched?.curr.length ? fetched.curr : files.curr ? parseCurrOhlc(files.curr) : [],
          pre: fetched?.pre.length ? fetched.pre : files.pre ? parsePreOhlc(files.pre) : [],
          rsi: files.mrsi ? parseMrsi(files.mrsi) : [],
          ind015: files.ind015 ? parseInd015(files.ind015) : [],
          ind120: files.ind120 ? parseInd120(files.ind120) : [],
          fusion: files.fusion ? parseFusion(files.fusion) : [],
        };
        if (inputs.curr.length === 0) {
          setError("No current-period OHLC available. Auto-fetch or upload the Curr OHLC file.");
          return;
        }
        res = runScreen(inputs);
      }
      setResult(res);
      setSavedAt(Date.now());
      void saveResult(market.id, res).then(setSavedAt);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(`Failed to generate: ${(e as Error).message}`);
    }
  }

  function handleReset() {
    void clearResult(market.id);
    setSavedAt(null);
    setResult(null);
  }

  return (
    <div className="market">
      <div className="market-head">
        <h1>{market.label}</h1>
        <span className="brand-pill">{market.blurb}</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Upload the daily scanner files, auto-fetch {PeriodWord(market)} OHLC from NSE Bhavcopy, and generate the results.
      </p>

      {result && (
        <>
          {savedAt && (
            <div className="prev-banner">
              <span>
                Shared latest scan · generated {new Date(savedAt).toLocaleString()} · visible to everyone until a new
                scan is generated or it is reset.
              </span>
              <button className="ghost" onClick={handleReset}>
                Reset (clear for everyone)
              </button>
            </div>
          )}
          {isVsd ? (
            <VsdView result={result as VsdResult} />
          ) : (
            <ResultsView result={result as ScreenResult} views={market.views} />
          )}
        </>
      )}

      <div className="panel">
        <h2><span className="step">1</span> Scanner files{isVsd ? " — Fusion required (cloud/120ST optional)" : " — required for detail columns"}</h2>
        <div className="row">
          {market.scanner.map((s) => (
            <FileSlot key={s.id} spec={s} onLoad={onLoad} countRows={countLines} filled={!!files[s.id]} />
          ))}
        </div>
      </div>

      <div className="panel">
        <h2><span className="step">2</span> RSI source — required</h2>
        <div className="row">
          <FileSlot spec={market.rsi} onLoad={onLoad} countRows={countLines} filled={!!files.mrsi} />
          <div className="slot" style={{ borderStyle: "solid" }}>
            <div className="name">Why upload this?</div>
            <div className="hint">
              RSI / RSI Avg come straight from your scanner's MRSI_Digger export, so the numbers match your screen
              exactly. (OHLC is fetched separately from NSE Bhavcopy below.)
            </div>
            <div className={`status ${files.mrsi ? "ok" : "err"}`}>
              {files.mrsi ? "RSI loaded ✓" : "Required — upload MRSI_Digger"}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2><span className="step">3</span> {PeriodWord(market)} OHLC — NSE Bhavcopy</h2>
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
        {autoResp && <div className="muted" style={{ marginTop: 6 }}>Using official NSE Bhavcopy OHLC for {autoCount} symbols.</div>}
        {market.ohlcFallback.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Manual OHLC upload (use if NSE is unavailable, or to match a specific snapshot)
            </summary>
            <div className="row" style={{ marginTop: 12 }}>
              {market.ohlcFallback.map((s) => (
                <FileSlot key={s.id} spec={s} onLoad={onLoad} countRows={countLines} filled={!!files[s.id]} />
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="panel">
        <h2><span className="step">4</span> Generate</h2>
        <div className="actions">
          <button onClick={handleGenerate} disabled={!canGenerate}>
            Generate {market.label} Signals
          </button>
          {!canGenerate && (
            <span className="muted">
              Need MRSI{isVsd ? " + Fusion" : ""} (steps 1–2) and OHLC ({isVsd ? "Bhavcopy fetch" : "fetch or manual upload"}).
            </span>
          )}
        </div>
        {error && <div className="warnbox">{error}</div>}
      </div>
    </div>
  );
}
