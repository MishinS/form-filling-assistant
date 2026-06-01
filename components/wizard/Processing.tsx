"use client";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/primitives";

export default function Processing({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n();
  const stages = [
    { k: "proc_parse", d: "proc_parse_d", icon: "layers" },
    { k: "proc_extract", d: "proc_extract_d", icon: "sparkle" },
    { k: "proc_fill", d: "proc_fill_d", icon: "grid" },
  ];
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 4200;
    const stageCount = stages.length;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setPct(p);
      setActive(Math.min(stageCount - 1, Math.floor(p * stageCount)));
      if (p < 1) raf = requestAnimationFrame(tick); else setTimeout(onDone, 450);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "0 auto", padding: "20px 0" }}>
      <div style={{ position: "relative", width: 84, height: 84, margin: "8px auto 30px" }}>
        <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="42" cy="42" r="38" fill="none" stroke="var(--line-2)" strokeWidth="3" />
          <circle cx="42" cy="42" r="38" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * (1 - pct)} style={{ transition: "stroke-dashoffset .1s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span className="display tnum" style={{ fontSize: 20, fontWeight: 600 }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="col gap-10">
        {stages.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "wait";
          return (
            <div key={s.k} className="row gap-13" style={{ gap: 13, padding: "14px 16px", borderRadius: "var(--r-md)",
              background: state === "active" ? "var(--surface-2)" : "transparent",
              border: `1px solid ${state === "active" ? "var(--line-2)" : "transparent"}`,
              opacity: state === "wait" ? .45 : 1, transition: "all .3s" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", display: "grid", placeItems: "center",
                background: state === "done" ? "var(--ok-bg)" : "var(--surface-3)",
                color: state === "done" ? "var(--ok)" : "var(--text)", border: "1px solid var(--line-2)" }}>
                {state === "done" ? <Icon name="check" size={16} stroke={2.2} />
                  : state === "active" ? <Icon name="spin" size={17} className="spin" />
                  : <Icon name={s.icon} size={16} />}
              </span>
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t(s.k)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t(s.d)}</div>
              </div>
              {state === "active" && <Icon name="spin" size={14} className="spin" style={{ color: "var(--text-3)" }} />}
            </div>
          );
        })}
      </div>
      <div className="row gap-8 dim" style={{ justifyContent: "center", marginTop: 22, fontSize: 11.5 }}>
        <Icon name="bolt" size={12} />
        <span className="mono">{lang === "ru" ? "Бесплатная LLM" : "Free LLM"} · free model · on-device parse</span>
      </div>
    </div>
  );
}
