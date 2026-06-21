import { useRef, useState } from "react";

export interface SlotSpec {
  id: string;
  name: string;
  hint: string;
  /** A header token that must be present for the file to be accepted in this slot. */
  expectHeaderIncludes: string[];
}

interface Props {
  spec: SlotSpec;
  /** Called with the raw file text once a valid file is read. */
  onLoad: (id: string, text: string, count: number) => void;
  /** Parser used only to report a row count back to the user. */
  countRows: (text: string) => number;
  filled: boolean;
}

export function FileSlot({ spec, onLoad, countRows, filled }: Props) {
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    const header = (text.split(/\r?\n/, 1)[0] ?? "").toLowerCase();
    const missing = spec.expectHeaderIncludes.filter(
      (h) => !header.includes(h.toLowerCase()),
    );
    if (missing.length) {
      setStatus({ ok: false, msg: `Wrong file? missing column(s): ${missing.join(", ")}` });
      return;
    }
    const count = countRows(text);
    setStatus({ ok: true, msg: `${file.name} — ${count} rows` });
    onLoad(spec.id, text, count);
  }

  return (
    <div className={`slot ${filled ? "filled" : ""} ${status && !status.ok ? "error" : ""}`}>
      <div className="name">{spec.name}</div>
      <div className="hint">{spec.hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {status && <div className={`status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
    </div>
  );
}
