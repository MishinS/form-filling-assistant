"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tag, Icon } from "@/components/primitives";
import { PT_FIELDS, PT_GROUPS, type ExtractField } from "@/lib/extract/fields";
import { FIELDS as SEED_FIELDS, type PtField } from "@/lib/seed/pt";
import { buildRows } from "@/lib/review/rows";
import type { ExtractedValue } from "@/lib/types";
import type { ParsedDoc } from "@/lib/parse/types";
import FieldRow from "./FieldRow";

type Props = { values?: ExtractedValue[]; docs?: ParsedDoc[]; fields?: ExtractField[] };

export default function ReviewStep({ values, docs = [], fields = PT_FIELDS }: Props) {
  const { t, lang } = useI18n();
  const rows: PtField[] = values ? buildRows(fields, values, docs) : SEED_FIELDS;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(f => [f.id, f.value])));
  const [hover, setHover] = useState<string | null>(null);
  const lowCount = rows.filter(f => f.conf === "low").length;
  const confLabel = (lvl: PtField["conf"]) => t(lvl === "high" ? "conf_high" : lvl === "med" ? "conf_med" : "conf_low");

  return (
    <div className="fade-in" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 6 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>{t("review_h")}</h2>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8, maxWidth: 560 }}>{t("review_sub")}</p>
        </div>
        {lowCount > 0 && (
          <Tag tone="line" style={{ height: 28, color: "var(--warn)", borderColor: "rgba(215,177,105,.4)", flex: "none" }}>
            <Icon name="alert" size={12} />{lowCount} {t("needs_check")}
          </Tag>
        )}
      </div>

      {PT_GROUPS.map(g => {
        const fieldsInGroup = rows.filter(f => f.group === g.id);
        return (
          <div key={g.id} style={{ marginTop: 24 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 11 }}>{lang === "ru" ? g.ru : g.en}</div>

            <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2.4fr 1.5fr 92px", gap: 14, padding: "11px 16px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
                {["field", "value", "source", "confidence"].map(c => (
                  <div key={c} className="mono" style={{ fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", textAlign: c === "confidence" ? "right" : "left" }}>{t(c)}</div>
                ))}
              </div>
              {fieldsInGroup.map((f, i) => (
                <FieldRow key={f.id} f={f} val={vals[f.id]} onChange={v => setVals(s => ({ ...s, [f.id]: v }))}
                  confLabel={confLabel} hover={hover} setHover={setHover} last={i === fieldsInGroup.length - 1} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
