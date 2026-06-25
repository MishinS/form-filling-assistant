"use client";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Btn, Icon } from "@/components/primitives";
import { errorLabelKey } from "@/lib/llm/custom-model-view";
import type { CustomModelDTO } from "@/lib/db/user-models";

// Client-safe copy of presets (providers.ts imports node:dns/promises, can't be bundled here)
const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai",     label: "OpenAI" },
  { value: "anthropic",  label: "Anthropic" },
  { value: "google",     label: "Google Gemini" },
  { value: "custom",     label: "Custom" },
];

const fieldStyle = {
  background: "var(--surface-2)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-md)", padding: "9px 11px", fontSize: 13.5,
  outline: "none", width: "100%",
} as const;

const labelStyle = { fontSize: 12, color: "var(--text-2)" } as const;

interface FormState {
  provider: string;
  baseUrl: string;
  modelSlug: string;
  apiKey: string;
  label: string;
  consent: boolean;
}

const EMPTY_FORM: FormState = { provider: PROVIDER_OPTIONS[0].value, baseUrl: "", modelSlug: "", apiKey: "", label: "", consent: false };

export default function CustomModels() {
  const { t } = useI18n();
  const [models, setModels] = useState<CustomModelDTO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => { if (alive) setModels(d.models ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function refetch() {
    const r = await fetch("/api/models").catch(() => null);
    if (r?.ok) {
      const d = (await r.json()) as { models?: CustomModelDTO[] };
      setModels(d.models ?? []);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/models/${id}`, { method: "DELETE" });
    await refetch();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFlash(null);
    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        modelSlug: form.modelSlug.trim(),
        apiKey: form.apiKey.trim(),
        label: form.label.trim() || form.modelSlug.trim(),
        acceptTos: form.consent,
      };
      if (form.provider === "custom") body.baseUrl = form.baseUrl.trim();
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 201) {
        const data = (await res.json()) as { model: CustomModelDTO };
        setModels((prev) => [data.model, ...prev]);
        setForm(EMPTY_FORM);
        setShowForm(false);
        setFlash({ kind: "ok", text: t("cm_added") });
      } else {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setFlash({ kind: "err", text: t(errorLabelKey(data.code ?? "")) });
      }
    } catch {
      setFlash({ kind: "err", text: t("cm_err_provider_error") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col gap-12">
      <div className="row gap-8" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("cm_section")}</span>
        <Btn size="sm" variant="ghost" icon="plus" onClick={() => { setShowForm((v) => !v); setFlash(null); }}>
          {t("cm_add")}
        </Btn>
      </div>

      {/* Model list */}
      {models.length === 0 && !showForm && (
        <span className="muted" style={{ fontSize: 12.5 }}>{t("cm_empty")}</span>
      )}
      {models.map((m) => (
        <div key={m.id} className="row gap-10"
          style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--surface-2)",
            border: "1px solid var(--line)", alignItems: "center" }}>
          <div className="grow col gap-2" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {m.provider} · {m.modelSlug}
            </span>
            <span className="mono dim" style={{ fontSize: 11 }}>{m.maskedKey}</span>
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            title={t("cm_delete")}
            style={{ flex: "none", padding: 6, borderRadius: "var(--r-sm)", color: "var(--text-3)",
              background: "transparent", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--bad)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="col gap-10"
          style={{ padding: "14px 14px 12px", borderRadius: "var(--r-md)",
            background: "var(--surface-2)", border: "1px solid var(--line-2)" }}>

          <label className="col gap-5">
            <span style={labelStyle}>{t("cm_provider")}</span>
            <select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              style={{ ...fieldStyle, appearance: "none" }}>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          {form.provider === "custom" && (
            <label className="col gap-5">
              <span style={labelStyle}>{t("cm_base_url")}</span>
              <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://..." style={fieldStyle} autoComplete="off" />
            </label>
          )}

          <label className="col gap-5">
            <span style={labelStyle}>{t("cm_model_id")}</span>
            <input value={form.modelSlug} onChange={(e) => setForm((f) => ({ ...f, modelSlug: e.target.value }))}
              placeholder="gpt-4o" style={fieldStyle} autoComplete="off" />
          </label>

          <label className="col gap-5">
            <span style={labelStyle}>{t("cm_api_key")}</span>
            <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              style={fieldStyle} autoComplete="new-password" />
          </label>

          <label className="col gap-5">
            <span style={labelStyle}>{t("cm_label")}</span>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={form.modelSlug || "My model"} style={fieldStyle} autoComplete="off" />
          </label>

          <label className="row gap-8" style={{ alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={form.consent}
              onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
              style={{ marginTop: 3, flex: "none" }} />
            <span style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{t("cm_consent_ack")}</span>
          </label>

          {flash && (
            <span style={{ fontSize: 12.5, color: flash.kind === "ok" ? "var(--ok)" : "var(--bad)" }}>
              {flash.text}
            </span>
          )}

          <div className="row gap-8">
            <Btn variant="primary" size="sm" disabled={busy || !form.modelSlug.trim() || !form.apiKey.trim() || !form.consent}>
              {busy ? t("cm_testing") : t("cm_add")}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFlash(null); }}>
              <Icon name="x" size={13} />
            </Btn>
          </div>
        </form>
      )}

      {/* Flash outside form (success after close) */}
      {flash && !showForm && (
        <span style={{ fontSize: 12.5, color: flash.kind === "ok" ? "var(--ok)" : "var(--bad)" }}>
          {flash.text}
        </span>
      )}
    </div>
  );
}
