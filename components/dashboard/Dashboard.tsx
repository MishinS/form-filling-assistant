"use client";
import { useContext } from "react";
import { useI18n } from "@/lib/i18n";
import { Eyebrow, Btn } from "@/components/primitives";
import { HISTORY, TEMPLATES } from "@/lib/seed/pt";
import { WizardTrigger } from "@/components/shell/AppShell";
import RecentRow from "./RecentRow";

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { openNew, openReview } = useContext(WizardTrigger);
  const tplName = (id: string) => { const x = TEMPLATES.find(v => v.id === id); return x ? (lang === "ru" ? x.name_ru : x.name_en) : id; };

  const stats = [
    { k: "stat_total", v: "247", sub: "+18" },
    { k: "stat_month", v: "63",  sub: "+9" },
    { k: "stat_time",  v: "41ч", sub: lang === "ru" ? "≈ 11 мин/док" : "≈ 11 min/doc" },
    { k: "stat_acc",   v: "96%", sub: lang === "ru" ? "по полям" : "by field" },
  ];

  return (
    <div className="fade-in" style={{ padding: "44px 48px 64px", maxWidth: 1180, margin: "0 auto" }}>
      {/* Hero */}
      <Eyebrow>{t("dash_eyebrow")}</Eyebrow>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 46, lineHeight: 1.03, maxWidth: 720 }}>
          {t("dash_h1a")} <span style={{ color: "var(--text-3)" }}>{t("dash_h1b")}</span>
        </h1>
        <Btn variant="primary" size="lg" icon="plus" onClick={openNew}>{t("new_fill")}</Btn>
      </div>

      <p className="muted" style={{ maxWidth: 560, marginTop: 18, fontSize: 15.5 }}>{t("dash_sub")}</p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, marginTop: 40,
        background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        {stats.map(s => (
          <div key={s.k} style={{ background: "var(--surface-1)", padding: "20px 22px" }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".04em", color: "var(--text-3)", textTransform: "uppercase" }}>{t(s.k)}</div>
            <div className="row gap-8" style={{ alignItems: "baseline", marginTop: 12 }}>
              <span className="display tnum" style={{ fontSize: 32, fontWeight: 600 }}>{s.v}</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ok)" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent table */}
      <div style={{ marginTop: 36 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17 }}>{t("recent")}</h2>
          <span className="mono dim" style={{ fontSize: 12 }}>{HISTORY.length} / 247</span>
        </div>

        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          {/* head */}
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1.3fr 1.6fr 1.1fr 1.1fr 1fr 30px",
            gap: 16, padding: "13px 20px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
            {["col_doc", "col_template", "col_counter", "col_amount", "col_status", "col_date"].map(c => (
              <div key={c} className="mono" style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase" }}>{t(c)}</div>
            ))}
            <div />
          </div>
          {/* rows */}
          {HISTORY.map((r, i) => (
            <RecentRow key={r.id} r={r} tplName={tplName} onOpen={openReview} last={i === HISTORY.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
