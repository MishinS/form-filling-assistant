"use client";
import { useState, type CSSProperties, type ChangeEvent } from "react";
import type { PtField } from "@/lib/seed/pt";

type Props = {
  f: PtField; val: string; onChange: (v: string) => void;
  invalid?: boolean;
  id?: string;
  describedBy?: string;
  onEnter?: () => void;
  onFocusField?: () => void;
  inputRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

export default function FieldInput({ f, val, onChange, invalid = false, id, describedBy, onEnter, onFocusField, inputRef }: Props) {
  const [focus, setFocus] = useState(false);
  const border = invalid ? "var(--bad)" : focus ? "var(--line-strong)" : "transparent";
  const style: CSSProperties = {
    width: "100%", background: focus ? "var(--surface-2)" : "transparent",
    border: `1px solid ${border}`, borderRadius: "var(--r-sm)",
    padding: "7px 9px", fontSize: 13, color: "var(--text)", resize: "none", outline: "none", transition: "all .12s",
    fontFamily: f.unit ? "var(--font-mono)" : "var(--font-sans)",
  };
  const common = {
    id,
    value: val,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onFocus: () => { setFocus(true); onFocusField?.(); },
    onBlur: () => setFocus(false),
    // The red border alone cannot carry the state — announce it, and point at the
    // message explaining why (rendered by FieldRow) when there is one.
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };
  if (f.options?.length) {
    return (
      <select
        id={id}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocus(true); onFocusField?.(); }}
        onBlur={() => setFocus(false)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        style={{ ...style, resize: undefined }}
      >
        <option value="">—</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>{o.value} — {o.label_ru}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="row gap-8" style={{ alignItems: "flex-start" }}>
      {f.area
        ? <textarea {...common} ref={inputRef} rows={2} style={{ ...style, lineHeight: 1.4 }} />
        : <input {...common} ref={inputRef}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }}
            style={style} />}
      {f.unit && <span className="mono dim nowrap" style={{ fontSize: 11.5, paddingTop: 8 }}>{f.unit}</span>}
    </div>
  );
}
