import { useEffect, useState } from "react";
import { MarketPage } from "./components/MarketPage";
import { MARKETS } from "./markets";

export default function App() {
  const [marketId, setMarketId] = useState<string>(MARKETS[0].id);
  // Markets stay mounted once visited, so switching tabs preserves their state and does
  // NOT re-fetch the report each time.
  const [mounted, setMounted] = useState<string[]>([MARKETS[0].id]);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("hyperscan:theme") as "dark" | "light") || "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("hyperscan:theme", theme);
  }, [theme]);

  function select(id: string) {
    setMarketId(id);
    setMounted((m) => (m.includes(id) ? m : [...m, id]));
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">⚡</div>
          <div>
            <div className="brand-name">Hyper<span>Scan</span></div>
            <div className="brand-tag">AI-Driven Signal Generation</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">Markets</div>
          {MARKETS.map((m) => (
            <button
              key={m.id}
              className={`nav-item ${m.id === marketId ? "active" : ""}`}
              onClick={() => select(m.id)}
            >
              <span className="nav-item-label">{m.label}</span>
              <span className="nav-item-sub">{m.blurb}</span>
            </button>
          ))}
        </nav>

        <button
          className="theme-toggle sidebar-theme"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </aside>

      <main className="content">
        {/* Each visited market stays mounted (state preserved, no re-fetch on tab switch);
            inactive ones are just hidden. */}
        {MARKETS.filter((m) => mounted.includes(m.id)).map((m) => (
          <div key={m.id} style={{ display: m.id === marketId ? "block" : "none" }}>
            <MarketPage market={m} />
          </div>
        ))}
      </main>
    </div>
  );
}
