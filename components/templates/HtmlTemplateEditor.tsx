"use client";
import { useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Icon, Tag, Btn } from "@/components/primitives";
import { useToast } from "@/components/shell/Toast";
import type { ExtractField } from "@/lib/extract/fields";
import type { SlotMode } from "@/lib/render/html";
import { ED_GROUPS } from "@/lib/render/ed";
import { resolveEd, type EdDefaults } from "@/lib/templates/ed-custom";
import { MAX_INSTRUCTION_LENGTH } from "@/lib/templates/note";
import {
  reduce, EMPTY_DRAFT, previewHtml, insertAt, slotToken, errorKey, saveBody, nextUserId,
  type Action, type Draft, type Layer,
} from "./html-editor-core";

const SLOT_MODES: SlotMode[] = ["text", "breaks", "paragraphs", "contact", "list"];
type Tab = Layer;

const input: CSSProperties = {
  width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8,
  border: "1px solid var(--line-2)", background: "var(--surface-2)", color: "var(--text-1)", outline: "none",
};
const mono: CSSProperties = { ...input, fontFamily: "var(--font-mono)", fontSize: 12 };
const panel: CSSProperties = { border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surface-1)" };

function Label({ children }: { children: ReactNode }) {
  return <div className="mono" style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 5 }}>{children}</div>;
}

/** Редактор пользовательской версии «Паспорта Заказа и договора»: поля,
 *  инструкция и HTML-каркас. Вся логика — в `html-editor-core.ts`. */
export default function HtmlTemplateEditor({ defaults, initial }: { defaults: EdDefaults; initial: Draft }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const ru = lang === "ru";
  const { show } = useToast();
  const newLabel = { ru: t("ed_new_field"), en: t("ed_new_field") };
  const [draft, dispatch] = useReducer((d: Draft, a: Action) => reduce(d, a, defaults, newLabel), initial);
  const [baseline, setBaseline] = useState<Draft>(initial);
  const [tab, setTab] = useState<Tab>("fields");
  const [sel, setSel] = useState<string>(defaults.fields[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const skRef = useRef<HTMLTextAreaElement>(null);

  const eff = useMemo(() => resolveEd(draft, defaults), [draft, defaults]);
  const preview = useMemo(() => previewHtml(draft, defaults), [draft, defaults]);
  const problem = preview.ok ? null : (() => {
    const e = errorKey(preview.error);
    return t(e.key).replace("{name}", e.name);
  })();
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const field = eff.fields.find(f => f.id === sel) ?? eff.fields[0];
  const patch = (p: Partial<ExtractField>) => field && dispatch({ type: "field", id: field.id, patch: p });

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saveBody(draft)),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? t("mapping_save_err"));
        return;
      }
      setBaseline(draft);
      show(t("mapping_saved"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: "ed" }),
      });
      if (!res.ok) { setErr(t("mapping_save_err")); return; }
      dispatch({ type: "load", draft: EMPTY_DRAFT });
      setBaseline(EMPTY_DRAFT);
      setSel(defaults.fields[0]?.id ?? "");
      show(t("ed_reset_done"));
    } catch {
      setErr(t("mapping_save_err"));
    } finally {
      setSaving(false);
    }
  };

  const insertSlot = (name: string) => {
    const el = skRef.current;
    const at = el ? el.selectionStart : eff.skeleton.length;
    const r = insertAt(eff.skeleton, at, slotToken(name));
    dispatch({ type: "skeleton", value: r.text });
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(r.cursor, r.cursor); } });
  };

  const tabBtn = (id: Tab, label: string) => (
    <button key={id} onClick={() => setTab(id)} className="row gap-8"
      style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}`,
        color: tab === id ? "var(--text-1)" : "var(--text-3)" }}>
      {label}
      <Tag tone="mono" style={{ height: 18, fontSize: 9.5 }}>{draft[id] === null ? t("ed_badge_default") : t("ed_badge_custom")}</Tag>
    </button>
  );

  return (
    <div className="fade-in" style={{ padding: "28px clamp(14px,3vw,36px) 56px", maxWidth: 1280, margin: "0 auto" }}>
      <button onClick={() => router.push("/templates")} className="row gap-8 muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 22 }}>
        <Icon name="arrowL" size={15} />{t("nav_templates")}
      </button>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="row gap-10"><h1 style={{ fontSize: 26 }}>{t("ed_title")}</h1><Tag tone="mono" style={{ height: 24 }}>HTML</Tag></div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{t("ed_editor_h")}</p>
        </div>
        <div className="row gap-10" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {err && <span className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>{err}</span>}
          {!saving && dirty && !err && <span className="mono" style={{ fontSize: 11, color: "var(--warn)" }}>{t("mapping_unsaved")}</span>}
          <Btn variant="ghost" size="md" onClick={resetAll} disabled={saving}>{t("ed_reset_all")}</Btn>
          <Btn variant="primary" size="md" icon="check" disabled={!dirty || !!problem || saving} onClick={save}>
            {saving ? t("mapping_saving") : t("save")}
          </Btn>
        </div>
      </div>

      {problem && (
        <div role="alert" className="row gap-8" style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10,
          border: "1px solid var(--bad)", color: "var(--bad)", fontSize: 13 }}>
          <Icon name="alert" size={14} />{problem}
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        <div className="row">{tabBtn("fields", t("ed_tab_fields"))}{tabBtn("instruction", t("ed_tab_instruction"))}{tabBtn("skeleton", t("ed_tab_skeleton"))}</div>
        <Btn variant="quiet" size="sm" disabled={draft[tab] === null || saving} onClick={() => dispatch({ type: "resetLayer", layer: tab })}>
          {t("ed_reset_layer")}
        </Btn>
      </div>

      {tab === "fields" && field && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 18, alignItems: "start" }}>
          <div style={panel}>
            {eff.fields.map(f => (
              <button key={f.id} onClick={() => setSel(f.id)} className="row"
                style={{ width: "100%", justifyContent: "space-between", gap: 10, padding: "11px 16px", textAlign: "left",
                  borderBottom: "1px solid var(--line)", background: f.id === field.id ? "var(--surface-hi)" : "transparent" }}>
                <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ru ? f.label_ru : f.label_en}{f.required && <span style={{ color: "var(--warn)" }}> *</span>}
                </span>
                <Tag tone="mono" style={{ height: 20, flexShrink: 0 }}>{f.cell || "—"}</Tag>
              </button>
            ))}
            <div style={{ padding: 10 }}>
              <Btn variant="ghost" size="sm" icon="plus" onClick={() => {
                setSel(nextUserId(eff.fields)); // тот же id, что выдаст редьюсер
                dispatch({ type: "addField" });
              }}>{t("add_field")}</Btn>
            </div>
          </div>

          <div style={{ ...panel, padding: 18 }} className="col gap-14">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <Tag tone="mono" style={{ height: 22 }}>{field.id}</Tag>
              <Btn variant="quiet" size="sm" icon="trash" onClick={() => { dispatch({ type: "deleteField", id: field.id }); setSel(""); }}>
                {t("ed_delete_field")}
              </Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><Label>{t("ed_col_label_ru")}</Label><input style={input} value={field.label_ru} onChange={e => patch({ label_ru: e.target.value })} /></div>
              <div><Label>{t("ed_col_label_en")}</Label><input style={input} value={field.label_en} onChange={e => patch({ label_en: e.target.value })} /></div>
            </div>
            <div><Label>{t("ed_col_hint")}</Label>
              <textarea style={{ ...input, minHeight: 58, resize: "vertical" }} maxLength={200} value={field.hint_ru ?? ""}
                onChange={e => patch({ hint_ru: e.target.value || undefined })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><Label>{t("ed_col_slot")}</Label><input style={mono} value={field.cell} onChange={e => patch({ cell: e.target.value.trim() })} /></div>
              <div><Label>{t("ed_col_mode")}</Label>
                <select style={input} value={field.slotMode ?? "text"} onChange={e => patch({ slotMode: e.target.value as SlotMode })}>
                  {SLOT_MODES.map(m => <option key={m} value={m}>{t(`ed_mode_${m}`)}</option>)}
                </select></div>
              <div><Label>{t("ed_col_group")}</Label>
                <select style={input} value={field.group} onChange={e => patch({ group: e.target.value as ExtractField["group"] })}>
                  {ED_GROUPS.map(g => <option key={g.id} value={g.id}>{ru ? g.ru : g.en}</option>)}
                </select></div>
            </div>
            <label className="row gap-8" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={field.required} onChange={e => patch({ required: e.target.checked })} />{t("required")}
            </label>
            <label className="row gap-8" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={field.fillMode === "constant"}
                onChange={e => patch(e.target.checked
                  ? { fillMode: "constant", constantValue: field.constantValue ?? "", strategy: "manual" }
                  : { fillMode: undefined, constantValue: undefined, strategy: "llm" })} />{t("ed_constant")}
            </label>
            {field.fillMode === "constant" ? (
              <div><Label>{t("ed_col_constant")}</Label><input style={input} maxLength={500} value={field.constantValue ?? ""} onChange={e => patch({ constantValue: e.target.value })} /></div>
            ) : (
              <div><Label>{t("ed_col_default")}</Label><input style={input} maxLength={500} value={field.defaultValue ?? ""} onChange={e => patch({ defaultValue: e.target.value || undefined })} /></div>
            )}
            {field.options && (
              <div>
                <Label>{t("ed_options")}</Label>
                <div className="col gap-8">
                  {field.options.map((o, i) => {
                    const set = (p: Partial<typeof o>) => patch({ options: field.options!.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 30px", gap: 8 }}>
                        <input style={input} placeholder={t("ed_option_value")} value={o.value} onChange={e => set({ value: e.target.value })} />
                        <input style={input} placeholder="RU" value={o.label_ru} onChange={e => set({ label_ru: e.target.value })} />
                        <input style={input} placeholder="EN" value={o.label_en} onChange={e => set({ label_en: e.target.value })} />
                        <button className="dim" aria-label={t("ed_option_remove")} disabled={field.options!.length <= 1}
                          onClick={() => patch({ options: field.options!.filter((_, j) => j !== i) })}><Icon name="trash" size={13} /></button>
                      </div>
                    );
                  })}
                  <div><Btn variant="ghost" size="sm" icon="plus"
                    onClick={() => patch({ options: [...field.options!, { value: "", label_ru: "", label_en: "" }] })}>{t("ed_option_add")}</Btn></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "instruction" && (
        <div style={{ ...panel, padding: 18 }}>
          <Label>{t("ed_tab_instruction")}</Label>
          <textarea style={{ ...input, minHeight: 260, resize: "vertical", lineHeight: 1.5 }} value={eff.instruction}
            onChange={e => dispatch({ type: "instruction", value: e.target.value })} />
          <div className="mono dim" style={{ fontSize: 11, marginTop: 6 }}>{eff.instruction.length} / {MAX_INSTRUCTION_LENGTH}</div>
        </div>
      )}

      {tab === "skeleton" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
          <div style={{ ...panel, padding: 14 }} className="col gap-10">
            <div className="row gap-8">
              <Label>{t("ed_slot_insert")}</Label>
              <select style={{ ...input, width: "auto" }} value="" onChange={e => { if (e.target.value) insertSlot(e.target.value); }}>
                <option value="">—</option>
                {eff.fields.filter(f => f.cell).map(f => <option key={f.id} value={f.cell}>{f.cell} · {ru ? f.label_ru : f.label_en}</option>)}
              </select>
            </div>
            <textarea ref={skRef} spellCheck={false} style={{ ...mono, minHeight: 520, resize: "vertical", whiteSpace: "pre", lineHeight: 1.45 }}
              value={eff.skeleton} onChange={e => dispatch({ type: "skeleton", value: e.target.value })} />
          </div>
          <div style={{ ...panel, position: "sticky", top: 20 }}>
            <div className="row gap-8" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
              <Icon name="eye" size={14} className="muted" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("preview")}</span>
            </div>
            {/* sandbox="" — скрипты черновика не выполняются, его стили не текут в приложение. */}
            {preview.ok
              ? <iframe title={t("preview")} sandbox="" srcDoc={preview.html} style={{ width: "100%", height: 560, border: 0, background: "#fff" }} />
              : <div className="muted" style={{ padding: 18, fontSize: 13 }}>{problem}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
