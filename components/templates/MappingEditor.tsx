"use client";
import { useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";
import { PT_FIELDS, isCellLocked, isReservedCell, newManualField, type ExtractField, type Strategy } from "@/lib/extract/fields";
import { validateCellRef } from "@/lib/templates/cellref";
import { TemplateMappingContext } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/Toast";
import MiniSheet from "./MiniSheet";

export interface EditorTpl {
  id: string; code: string; name_ru: string; name_en: string;
  desc_ru: string; desc_en: string; format: string; sheets: string[]; own: boolean;
}

const ruleText = (f: ExtractField, ru: boolean) =>
  f.strategy === "llm" ? (ru ? "LLM · по контексту" : "LLM · contextual")
  : f.strategy === "manual" ? (ru ? "Ручной ввод" : "Manual")
  : (ru ? "Парсер · регулярка" : "Parser · regex");

const ruleTone = (s: Strategy) => s === "llm" ? "var(--info)" : s === "manual" ? "var(--text-3)" : "var(--ok)";

export default function MappingEditor({ tpl, initialFields, defaultFields }: {
  tpl: EditorTpl;
  initialFields: ExtractField[] | null;   // null → ПТ: take from TemplateMappingContext
  defaultFields: ExtractField[] | null;   // reset target for own templates; null → PT_FIELDS
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const ru = lang === "ru";
  const isPt = tpl.id === "pt";
  const ctx = useContext(TemplateMappingContext);
  const { show } = useToast();
  const initial = isPt ? ctx.fields : (initialFields ?? []);
  const templateId = tpl.id;

  const [draft, setDraft] = useState<ExtractField[]>(initial);
  // Last-saved snapshot: for custom templates `initialFields` is an immutable prop, so
  // the dirty check must compare against a state that we advance on save/reset.
  const [baseline, setBaseline] = useState<ExtractField[]>(initial);
  const [sel, setSel] = useState(initial[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(ru ? tpl.name_ru : tpl.name_en);
  const [desc, setDesc] = useState(ru ? tpl.desc_ru : tpl.desc_en);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rows = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  // Per-row cell error (invalid / wrong sheet) keyed by field id.
  const cellErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const f of draft) {
      // A custom template may carry not-yet-mapped fields (empty cell) — allowed and
      // non-blocking (fill skips them). ПТ keeps its cells strict.
      if (!f.cell.trim() && !isPt) continue;
      const r = validateCellRef(f.cell, isPt ? undefined : tpl.sheets);
      if (!r.ok) errs[f.id] = r.reason === "sheet" ? (isPt ? t("cell_sheet_pt") : t("cell_sheet_bad")) : t("cell_invalid");
      else if (isPt && !isCellLocked(f.id) && isReservedCell(r.normalized)) errs[f.id] = t("cell_reserved");
    }
    return errs;
  }, [draft, isPt, tpl.sheets, t]);
  const dupeCells = useMemo(() => {
    const seen = new Map<string, number>();
    for (const f of draft) { if (!f.cell.trim()) continue; seen.set(f.cell, (seen.get(f.cell) ?? 0) + 1); } // empty = unmapped, not a dupe
    return new Set([...Array.from(seen)].filter(([, n]) => n > 1).map(([c]) => c));
  }, [draft]);
  const canSave = Object.keys(cellErrors).length === 0 && dupeCells.size === 0;

  const editLabel = (id: string, v: string) =>
    setDraft(d => d.map(f => f.id === id ? { ...f, [ru ? "label_ru" : "label_en"]: v } : f));
  const editCell = (id: string, v: string) =>
    setDraft(d => d.map(f => f.id === id ? { ...f, cell: v } : f));
  const toggleReq = (id: string) =>
    setDraft(d => d.map(f => f.id === id ? { ...f, required: !f.required } : f));
  const editKind = (id: string, k: ExtractField["kind"]) =>
    setDraft(d => d.map(f => f.id === id ? { ...f, kind: k } : f));
  const setMode = (id: string, mode: ExtractField["fillMode"]) =>
    setDraft(d => d.map(f => {
      if (f.id !== id) return f;
      if (mode === "constant") return { ...f, fillMode: "constant", constantValue: f.constantValue ?? "", dateRule: undefined };
      if (mode === "date") return { ...f, fillMode: "date", dateRule: f.dateRule ?? { offset: "today", format: "dmy" }, constantValue: undefined };
      return { ...f, fillMode: undefined, constantValue: undefined, dateRule: undefined }; // auto
    }));
  const setConst = (id: string, v: string) =>
    setDraft(d => d.map(f => f.id === id ? { ...f, constantValue: v } : f));
  const setDate = (id: string, patch: Partial<NonNullable<ExtractField["dateRule"]>>) =>
    setDraft(d => d.map(f => f.id === id && f.dateRule ? { ...f, dateRule: { ...f.dateRule, ...patch } } : f));
  const del = (id: string) => setDraft(d => d.filter(f => f.id !== id));
  const add = () => {
    // Compute the new id INSIDE the updater so a rapid double-add can't mint two
    // fields with the same fN id (each updater sees the previous one's result).
    setDraft(d => {
      const f = newManualField(d, { label_ru: t("new_field_label"), label_en: t("new_field_label"), kind: "string", cell: "" });
      setSel(f.id);
      return [...d, f];
    });
  };
  const save = async () => {
    // Normalize cells on save
    const normalized = draft.map(f => {
      const r = validateCellRef(f.cell, isPt ? undefined : tpl.sheets);
      return r.ok ? { ...f, cell: r.normalized } : f;
    });
    if (isPt) ctx.setFields(normalized);   // session-live immediately for ПТ
    setDraft(normalized);
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fields: normalized }),
      });
      if (!res.ok) { setErr(t("mapping_save_err")); return; }
      setBaseline(normalized); // persisted → new saved snapshot (clears the "unsaved" flag)
      if (tpl.own && (name.trim() !== (ru ? tpl.name_ru : tpl.name_en) || desc.trim() !== (ru ? tpl.desc_ru : tpl.desc_en))) {
        const r2 = await fetch(`/api/templates/${tpl.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), desc: desc.trim() }),
        });
        if (!r2.ok) { setErr(t("tpl_renamed_err")); return; }
        router.refresh();
      }
      show(t("mapping_saved"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    const target = isPt ? PT_FIELDS : (defaultFields ?? []);
    if (isPt) ctx.resetFields();              // revert the session immediately
    setDraft(target);
    setBaseline(target);                      // reset baseline so the dirty flag clears
    setSel(target[0]?.id ?? "");
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) setErr(t("mapping_save_err"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };

  const miniTitle = ru ? (tpl.own ? name : tpl.name_ru) : (tpl.own ? name : tpl.name_en);

  return (
    <div className="fade-in" style={{ padding: "28px 36px 56px", maxWidth: 1280, margin: "0 auto" }}>
      <button onClick={() => router.push("/templates")} className="row gap-8 muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 22 }}>
        <Icon name="arrowL" size={15} />{t("nav_templates")}
      </button>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <div className="row gap-10">
            {tpl.own ? (
              <input value={name} onChange={e => setName(e.target.value)} disabled={saving || deleting}
                style={{ fontSize: 24, fontWeight: 650, background: "transparent", border: "none", borderBottom: "1px dashed var(--line-2)", outline: "none", minWidth: 280 }} />
            ) : (
              <h1 style={{ fontSize: 26 }}>{ru ? tpl.name_ru : tpl.name_en}</h1>
            )}
            <Tag tone="mono" style={{ height: 24 }}>{tpl.format}</Tag>
            <Tag tone="mono" style={{ height: 24 }}>{tpl.code}</Tag>
          </div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{t("mapping_h")}</p>
          {tpl.own && (
            <input value={desc} onChange={e => setDesc(e.target.value)} disabled={saving || deleting}
              placeholder={t("tpl_new_desc")} className="muted"
              style={{ fontSize: 13, background: "transparent", border: "none", borderBottom: "1px dashed var(--line-2)", outline: "none", width: 420, marginTop: 6 }} />
          )}
        </div>
        <div className="row gap-10" style={{ alignItems: "center" }}>
          {err && <span className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>{err}</span>}
          {!err && saving && <span className="mono dim" style={{ fontSize: 11 }}>{t("mapping_saving")}</span>}
          {!saving && dirty && <span className="mono dim" style={{ fontSize: 11, color: "var(--warn)" }}>{t("mapping_unsaved")}</span>}
          {tpl.own && !confirmDel && (
            <Btn variant="ghost" size="md" onClick={() => setConfirmDel(true)} disabled={saving || deleting}>{t("tpl_delete")}</Btn>
          )}
          {tpl.own && confirmDel && (
            <>
              <span className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>{t("tpl_delete_sure")}</span>
              <Btn variant="ghost" size="md" disabled={deleting} onClick={async () => {
                setDeleting(true);
                try {
                  const res = await fetch(`/api/templates/${tpl.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("del");
                  router.push("/templates");
                  router.refresh();
                } catch {
                  setErr(t("tpl_delete_err"));
                  setDeleting(false);
                  setConfirmDel(false);
                }
              }}>{deleting ? t("tpl_deleting") : t("tpl_delete")}</Btn>
              <Btn variant="ghost" size="md" onClick={() => setConfirmDel(false)} disabled={deleting}>{t("cancel")}</Btn>
            </>
          )}
          <Btn variant="ghost" size="md" onClick={reset} disabled={saving}>{t("tpl_reset")}</Btn>
          <Btn variant="ghost" size="md" icon="plus" onClick={add} disabled={saving}>{t("add_field")}</Btn>
          <Btn variant="primary" size="md" icon="check" disabled={!dirty || !canSave || saving} onClick={save}>{saving ? t("mapping_saving") : t("save")}</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1.7fr 92px 44px 30px", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--line)", color: "var(--text-3)" }}>
            {[t("field"), t("rule"), t("cell"), t("required"), ""].map((c, i) => (
              <div key={i} className="mono" style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase" }}>{c}</div>
            ))}
          </div>
          {rows.map((f, i) => {
            const on = sel === f.id;
            const locked = isCellLocked(f.id);
            const cellErr = cellErrors[f.id];
            const dupe = !cellErr && dupeCells.has(f.cell);
            return (
              <div key={f.id} onClick={() => setSel(f.id)}
                style={{ display: "grid", gridTemplateColumns: "1.15fr 1.7fr 92px 44px 30px", gap: 10, padding: "12px 16px", alignItems: "center",
                  cursor: "pointer", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)",
                  background: on ? "var(--surface-3)" : "transparent", transition: "background .12s" }}>
                {/* field label */}
                <div style={{ minWidth: 0 }}>
                  <input value={ru ? f.label_ru : f.label_en} onClick={e => e.stopPropagation()} onChange={e => editLabel(f.id, e.target.value)}
                    style={{ width: "100%", fontSize: 12.5, fontWeight: 600, background: "transparent", border: "1px solid transparent", borderRadius: 5, padding: "2px 4px" }}
                    onFocus={e => e.currentTarget.style.borderColor = "var(--line-2)"} onBlur={e => e.currentTarget.style.borderColor = "transparent"} />
                  <select value={f.kind} onClick={e => e.stopPropagation()} onChange={e => editKind(f.id, e.target.value as ExtractField["kind"])}
                    className="mono dim" style={{ fontSize: 10, background: "transparent", border: "none", marginLeft: 4 }}>
                    <option value="string">{t("kind_string")}</option>
                    <option value="text">{t("kind_text")}</option>
                    <option value="amount">{t("kind_amount")}</option>
                    <option value="date">{t("kind_date")}</option>
                  </select>
                </div>
                {/* fill mode + controls */}
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 4, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                  {locked ? (
                    <div className="row gap-6">
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: ruleTone(f.strategy), flex: "none" }} />
                      <span className="muted" style={{ fontSize: 11.5 }}>{ruleText(f, ru)}</span>
                    </div>
                  ) : (
                    <>
                      <select value={f.fillMode ?? "auto"} onChange={e => setMode(f.id, e.target.value as ExtractField["fillMode"])}
                        className="mono" style={{ width: "100%", minWidth: 0, fontSize: 10.5, background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 5, padding: "2px 4px" }}>
                        <option value="auto">{t("mode_auto")}</option>
                        <option value="constant">{t("mode_constant")}</option>
                        <option value="date">{t("mode_date")}</option>
                      </select>
                      {(!f.fillMode || f.fillMode === "auto") && (
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ruleText(f, ru)}</span>
                      )}
                      {f.fillMode === "constant" && (
                        <input value={f.constantValue ?? ""} onChange={e => setConst(f.id, e.target.value)} placeholder={t("mode_const_ph")}
                          style={{ width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: 11, padding: "2px 5px", borderRadius: 5, border: "1px solid var(--line-2)", background: "var(--surface-2)" }} />
                      )}
                      {f.fillMode === "date" && f.dateRule && (
                        <div style={{ display: "flex", gap: 4, width: "100%" }}>
                          <select value={f.dateRule.offset} onChange={e => setDate(f.id, { offset: e.target.value as NonNullable<ExtractField["dateRule"]>["offset"] })}
                            className="mono" style={{ flex: 1, minWidth: 0, width: "100%", fontSize: 10, padding: "2px 3px", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 5 }}>
                            <option value="today">{t("date_off_today")}</option>
                            <option value="nextDay">{t("date_off_nextDay")}</option>
                            <option value="nextMonthSameDay">{t("date_off_nextMonthSameDay")}</option>
                            <option value="firstOfNextMonth">{t("date_off_firstOfNextMonth")}</option>
                          </select>
                          <select value={f.dateRule.format} onChange={e => setDate(f.id, { format: e.target.value as NonNullable<ExtractField["dateRule"]>["format"] })}
                            className="mono" style={{ flex: 1, minWidth: 0, width: "100%", fontSize: 10, padding: "2px 3px", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 5 }}>
                            <option value="dmy">{t("date_fmt_dmy")}</option>
                            <option value="monthYear">{t("date_fmt_monthYear")}</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* cell */}
                <div onClick={e => e.stopPropagation()}>
                  {locked ? (
                    <Tag tone="mono" style={{ height: 22 }} title={t("cell_locked")}>{f.cell.replace("ПТ!", "")}</Tag>
                  ) : (
                    <input value={f.cell} onChange={e => editCell(f.id, e.target.value)} placeholder={t("cell_unmapped")}
                      className="mono" style={{ width: "100%", fontSize: 11, padding: "3px 6px", borderRadius: 5,
                        border: `1px solid ${cellErr ? "var(--bad)" : dupe ? "var(--warn)" : "var(--line-2)"}`, background: "var(--surface-2)", color: "var(--text-2)" }} />
                  )}
                  {cellErr && <div style={{ fontSize: 9.5, color: "var(--bad)", marginTop: 2 }}>{cellErr}</div>}
                  {dupe && <div style={{ fontSize: 9.5, color: "var(--warn)", marginTop: 2 }}>{t("cell_dupe")}</div>}
                </div>
                {/* required */}
                <div>
                  <button onClick={e => { e.stopPropagation(); toggleReq(f.id); }}
                    style={{ width: 16, height: 16, borderRadius: 5, background: f.required ? "var(--surface-hi)" : "transparent",
                      border: "1px solid var(--line-2)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                    {f.required && <Icon name="check" size={10} stroke={2.4} />}
                  </button>
                </div>
                {/* delete — hidden for schedule-locked rows (f4/f7 drive the amount cells) */}
                {locked ? <span /> : (
                  <button className="dim" style={{ width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center" }}
                    onClick={e => { e.stopPropagation(); del(f.id); }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hi)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}><Icon name="trash" size={13} /></button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)", position: "sticky", top: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
            <div className="row gap-8"><Icon name="eye" size={14} className="muted" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("preview")}</span></div>
            <Tag tone="mono" style={{ height: 22 }}>{rows.find(f => f.id === sel)?.cell || "—"}</Tag>
          </div>
          <MiniSheet fields={rows} sel={sel} title={miniTitle} />
        </div>
      </div>
    </div>
  );
}
