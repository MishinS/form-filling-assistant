"use client";
import { useContext } from "react";
import { useI18n } from "@/lib/i18n";
import { Eyebrow, Btn } from "@/components/primitives";
import type { HistoryRowData } from "@/lib/db/map";
import type { FillStats } from "@/lib/db/fills";
import { formatFillDate } from "@/lib/db/map";
import { WizardTrigger, TemplatesContext } from "@/components/shell/AppShell";
import RecentRow from "./RecentRow";

export default function Dashboard({ fills, stats }: { fills: HistoryRowData[]; stats: FillStats }) {
  const { t, lang } = useI18n();
  const { openNew } = useContext(WizardTrigger);
  const { nameOf } = useContext(TemplatesContext);
  const tplName = (id: string) => { const n = nameOf(id); return n ? (lang === "ru" ? n.ru : n.en) : id; };

  const statCards = [
    { k: "stat_total", v: String(stats.total) },
    { k: "stat_month", v: String(stats.month) },
    { k: "stat_last",  v: stats.last ? formatFillDate(stats.last, lang).split(",")[0] : "—" },
  ];

  return (
    <div className="fade-in" style={{ padding: "44px clamp(16px,4vw,48px) 64px", maxWidth: 1180, margin: "0 auto" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1, marginTop: 40,
        background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        {statCards.map(s => (
          <div key={s.k} style={{ background: "var(--surface-1)", padding: "20px 22px" }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".04em", color: "var(--text-3)", textTransform: "uppercase" }}>{t(s.k)}</div>
            <div className="row gap-8" style={{ alignItems: "baseline", marginTop: 12 }}>
              <span className="display tnum" style={{ fontSize: 32, fontWeight: 600 }}>{s.v}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent table */}
      <div style={{ marginTop: 36 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17 }}>{t("recent")}</h2>
          <span className="mono dim" style={{ fontSize: 12 }}>{fills.length}</span>
        </div>

        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          {/* head */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1fr) 30px",
            gap: 16, padding: "13px 20px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
            {["col_doc", "col_template", "col_counter", "col_amount", "col_status", "col_date"].map(c => (
              <div key={c} className="mono" style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase" }}>{t(c)}</div>
            ))}
            <div />
          </div>
          {/* rows */}
          {fills.length === 0 ? (
            <div className="muted" style={{ padding: "28px 20px", fontSize: 13.5, textAlign: "center" }}>{t("fills_empty")}</div>
          ) : (
            fills.map((r, i) => (
              <RecentRow key={r.id} r={r} tplName={tplName} dateText={formatFillDate(r.createdAt, lang)} last={i === fills.length - 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
