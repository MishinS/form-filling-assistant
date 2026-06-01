"use client";
import { useState, type CSSProperties, type ChangeEvent } from "react";
import type { PtField } from "@/lib/seed/pt";

type Props = { f: PtField; val: string; onChange: (v: string) => void };

export default function FieldInput({ f, val, onChange }: Props) {
  const [focus, setFocus] = useState(false);
  const style: CSSProperties = {
    width: "100%", background: focus ? "var(--surface-2)" : "transparent",
    border: `1px solid ${focus ? "var(--line-strong)" : "transparent"}`, borderRadius: "var(--r-sm)",
    padding: "7px 9px", fontSize: 13, color: "var(--text)", resize: "none", outline: "none", transition: "all .12s",
    fontFamily: f.unit ? "var(--font-mono)" : "var(--font-sans)",
  };
  const common = {
    value: val,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  };
  return (
    <div className="row gap-8" style={{ alignItems: "flex-start" }}>
      {f.area
        ? <textarea {...common} rows={2} style={{ ...style, lineHeight: 1.4 }} />
        : <input {...common} style={style} />}
      {f.unit && <span className="mono dim nowrap" style={{ fontSize: 11.5, paddingTop: 8 }}>{f.unit}</span>}
    </div>
  );
}
