"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tag, Icon } from "@/components/primitives";
import { PT_FIELDS, PT_GROUPS, type ExtractField } from "@/lib/extract/fields";
import { FIELDS as SEED_FIELDS, type PtField } from "@/lib/seed/pt";
import { buildRows, missingRequired } from "@/lib/review/rows";
import { attentionOf, nextAttentionIndex, type Attention } from "@/lib/review/attention";
import { invalidReason, type InvalidReason } from "@/lib/review/validate";
import type { ExtractedValue } from "@/lib/types";
import type { ParsedDoc } from "@/lib/parse/types";
import FieldRow from "./FieldRow";

type Props = { values?: ExtractedValue[]; docs?: ParsedDoc[]; fields?: ExtractField[]; warnings?: string[]; onChange?: (values: ExtractedValue[]) => void };

export default function ReviewStep({ values, docs = [], fields = PT_FIELDS, warnings = [], onChange }: Props) {
  const { t, lang } = useI18n();
  const rows: PtField[] = values ? buildRows(fields, values, docs) : SEED_FIELDS;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(f => [f.id, f.value])));
  const [hover, setHover] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  // Rows the user has dealt with — edited, or confirmed with Enter. Suppresses the
  // `low` flag only (see attentionOf); ephemeral, never leaves this step.
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const markReviewed = (id: string) => setReviewed(s => s.has(id) ? s : new Set(s).add(id));
  // Where the user last was. Updated by every focus — click, Tab, and our own
  // .focus() below — so navigation continues from there instead of restarting at
  // the first flagged row. Survives focus moving to the button, which is why this
  // is a ref and not a read of document.activeElement at click time.
  const cursorId = useRef<string | null>(null);

  useEffect(() => {
    onChange?.(rows.map(r => ({
      fieldId: r.id,
      value: vals[r.id] ?? "",
      confidence: r.conf,
      source: { fileId: null, locator: r.src?.loc ?? "" },
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals]);

  // Flat visual order (matches the grouped render below) + per-row attention.
  const fieldById = new Map(fields.map(f => [f.id, f]));
  const ordered = PT_GROUPS.flatMap(g => rows.filter(f => f.group === g.id));
  const attnById = new Map<string, Attention>(
    ordered.map(f => {
      const ef = fieldById.get(f.id);
      return [f.id, attentionOf({ kind: ef?.kind ?? "string", required: ef?.required ?? false, conf: f.conf, value: vals[f.id] ?? "", reviewed: reviewed.has(f.id) })];
    }),
  );
  // Why a row is invalid, recorded in the same walk. This is the only place holding
  // both the field kind and the live value — `PtField` carries no kind, so the row
  // cannot work it out itself. Same source as the flag (`isValidValue` derives from
  // `invalidReason`), so a flag without a reason is not representable.
  const reasonById = new Map<string, InvalidReason | null>(
    ordered.map(f => [f.id, invalidReason(fieldById.get(f.id)?.kind ?? "string", vals[f.id] ?? "")]),
  );
  const attentionCount = Array.from(attnById.values()).filter(a => a !== null).length;

  // No argument means "step from the cursor"; an explicit id steps from that row.
  const focusNext = (fromId: string | null = null) => {
    const id = fromId ?? cursorId.current;
    const from = id === null ? -1 : ordered.findIndex(f => f.id === id);
    const ni = nextAttentionIndex(ordered.map(f => ({ attention: attnById.get(f.id) ?? null })), from);
    if (ni >= 0) inputRefs.current.get(ordered[ni].id)?.focus();
  };

  const missingReq = missingRequired(fields, vals);
  const confLabel = (lvl: PtField["conf"]) => t(lvl === "high" ? "conf_high" : lvl === "med" ? "conf_med" : "conf_low");

  return (
    <div className="fade-in" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: 22 }}>{t("review_h")}</h2>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8, maxWidth: 560 }}>{t("review_sub")}</p>
      </div>

      {/* Status + navigation pin to the top of the wizard's scroll container, so the
          counts stay readable and the next-field button stays reachable without
          scrolling back up. The heading above scrolls away under it; the detailed
          warning lists below stay in flow so a long list cannot eat the viewport. */}
      {(attentionCount > 0 || missingReq.length > 0) && (
        <div className="row" style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
          justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
          marginTop: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <div className="row gap-8" style={{ alignItems: "center", flexWrap: "wrap" }}>
            {attentionCount > 0 && (
              <Tag tone="line" style={{ height: 28, color: "var(--warn)", borderColor: "var(--warn-border)" }}>
                <Icon name="alert" size={12} />{attentionCount} {t("needs_check")}
              </Tag>
            )}
            {missingReq.length > 0 && (
              <Tag tone="line" style={{ height: 28, color: "var(--warn)", borderColor: "var(--warn-border)" }}>
                {t("review_required_n")}: {missingReq.length}
              </Tag>
            )}
          </div>
          {attentionCount > 0 && (
            <button type="button" onClick={() => focusNext()} className="mono"
              style={{ height: 28, padding: "0 12px", borderRadius: "var(--pill)", fontSize: 11.5, fontWeight: 600,
                border: "1px solid var(--line-2)", color: "var(--text-2)", flex: "none" }}>{t("review_next")}</button>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="col gap-8" role="alert" style={{ marginTop: 16, padding: "12px 14px", borderRadius: "var(--r-lg)",
          background: "var(--bad-bg)", border: "1px solid var(--bad-border)" }}>
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
          background: "var(--surface-2)", border: "1px solid var(--warn-border)" }}>
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
                <FieldRow key={f.id} f={f} val={vals[f.id]} onChange={v => { markReviewed(f.id); setVals(s => ({ ...s, [f.id]: v })); }}
                  confLabel={confLabel} hover={hover} setHover={setHover} last={i === fieldsInGroup.length - 1}
                  attention={attnById.get(f.id) ?? null}
                  reason={reasonById.get(f.id) ?? null}
                  onEnter={() => { markReviewed(f.id); focusNext(f.id); }}
                  onFocusField={() => { cursorId.current = f.id; }}
                  registerRef={(el) => { if (el) inputRefs.current.set(f.id, el); else inputRefs.current.delete(f.id); }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
