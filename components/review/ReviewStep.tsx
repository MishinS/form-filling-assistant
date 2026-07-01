"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tag, Icon } from "@/components/primitives";
import { PT_FIELDS, PT_GROUPS, type ExtractField } from "@/lib/extract/fields";
import { FIELDS as SEED_FIELDS, type PtField } from "@/lib/seed/pt";
import { buildRows, missingRequired } from "@/lib/review/rows";
import type { ExtractedValue } from "@/lib/types";
import type { ParsedDoc } from "@/lib/parse/types";
import FieldRow from "./FieldRow";

type Props = { values?: ExtractedValue[]; docs?: ParsedDoc[]; fields?: ExtractField[]; warnings?: string[]; onChange?: (values: ExtractedValue[]) => void };

export default function ReviewStep({ values, docs = [], fields = PT_FIELDS, warnings = [], onChange }: Props) {
  const { t, lang } = useI18n();
  const rows: PtField[] = values ? buildRows(fields, values, docs) : SEED_FIELDS;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(f => [f.id, f.value])));
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    onChange?.(rows.map(r => ({
      fieldId: r.id,
      value: vals[r.id] ?? "",
      confidence: r.conf,
      source: { fileId: null, locator: r.src?.loc ?? "" },
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals]);
  const lowCount = rows.filter(f => f.conf === "low").length;
  const missingReq = missingRequired(fields, vals); // required-but-empty (live) → non-blocking warning
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

      {warnings.length > 0 && (
        <div className="col gap-8" role="alert" style={{ marginTop: 16, padding: "12px 14px", borderRadius: "var(--r-lg)",
          background: "var(--bad-bg)", border: "1px solid rgba(224,108,108,.35)" }}>
          <div className="row gap-8" style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>
            <Icon name="alert" size={14} />{t("review_warn")}
          </div>
          <ul className="muted" style={{ margin: 0, paddingLeft: 26, fontSize: 12.5, lineHeight: 1.5 }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {missingReq.length > 0 && (
        <div className="col gap-8" role="alert" style={{ marginTop: 16, padding: "12px 14px", borderRadius: "var(--r-lg)",
          background: "var(--surface-2)", border: "1px solid rgba(215,177,105,.4)" }}>
          <div className="row gap-8" style={{ color: "var(--warn)", fontSize: 13, fontWeight: 600 }}>
            <Icon name="alert" size={14} />{t("review_required_h")}
          </div>
          <ul className="muted" style={{ margin: 0, paddingLeft: 26, fontSize: 12.5, lineHeight: 1.5 }}>
            {missingReq.map(f => <li key={f.id}>{lang === "ru" ? f.label_ru : f.label_en}</li>)}
          </ul>
        </div>
      )}

      {PT_GROUPS.map(g => {
        const fieldsInGroup = rows.filter(f => f.group === g.id);
        return (
          <div key={g.id} style={{ marginTop: 24 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 11 }}>{lang === "ru" ? g.ru : g.en}</div>

            <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,2.4fr) minmax(0,1.5fr) 92px", gap: 14, padding: "11px 16px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
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
