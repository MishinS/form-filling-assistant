"use client";
import { useState, useRef, useEffect, useContext } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/primitives";
import { FREE_MODELS, PAID_LAST_RESORT, isPaidModel } from "@/lib/extract/llm/catalog";
import { ModelContext } from "./AppShell";

export default function ModelSelect() {
  const { lang } = useI18n();
  const { model: sel, setModel } = useContext(ModelContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const MODELS = [...FREE_MODELS, PAID_LAST_RESORT];
  const cur = MODELS.find(m => m.id === sel) ?? MODELS[0];
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 4px 7px" }}>
        {lang === "ru" ? "Модель извлечения" : "Extraction model"}
      </div>

      {open && (
        <div className="fade-in" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
          background: "var(--surface-hi)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)",
          padding: 5, boxShadow: "0 18px 50px rgba(0,0,0,.55)" }}>
          {MODELS.map(m => {
            const on = m.id === sel;
            return (
              <button key={m.id} onClick={() => { setModel(m.id); setOpen(false); }}
                className="row gap-10" style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "var(--r-sm)",
                  background: on ? "var(--surface-2)" : "transparent", transition: "background .12s" }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <Icon name="bolt" size={13} style={{ color: on ? "var(--text)" : "var(--text-3)", marginTop: 2 }} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{m.name}</div>
                  <div className="mono dim" style={{ fontSize: 10 }}>{m.provider}</div>
                </div>
                {isPaidModel(m.id) ? (
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-hi)",
                    border: "1px solid var(--line-2)", borderRadius: 99, padding: "2px 7px", flex: "none" }}>платная</span>
                ) : (
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ok)", background: "var(--ok-bg)",
                    borderRadius: 99, padding: "2px 7px", flex: "none" }}>free</span>
                )}
                {on && <Icon name="check" size={13} stroke={2.2} style={{ color: "var(--text)", flex: "none" }} />}
              </button>
            );
          })}
          <div className="dim" style={{ fontSize: 10.5, lineHeight: 1.4, padding: "8px 10px 5px", borderTop: "1px solid var(--line)", marginTop: 4 }}>
            {lang === "ru" ? "Бесплатные модели; платная — резерв при перегрузке." : "Free models; the paid one is a fallback when busy."}
          </div>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} className="row gap-10"
        style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", textAlign: "left",
          background: "var(--surface-2)", border: `1px solid ${open ? "var(--line-strong)" : "var(--line)"}`, transition: "border-color .15s" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flex: "none", display: "grid", placeItems: "center",
          background: "var(--surface-hi)", border: "1px solid var(--line-2)" }}><Icon name="bolt" size={13} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.name}</div>
          <div className="mono dim" style={{ fontSize: 10 }}>{cur.provider}</div>
        </div>
        <Icon name="chevD" size={14} className="muted" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s var(--ease)" }} />
      </button>
    </div>
  );
}
