"use client";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/primitives";
import { NOTE_LIMIT, type NoteState } from "./note-core";

type Props = { value: string; onChange: (v: string) => void; state: NoteState };

/** Заметка к прогону: контекст, которого в документах поставщика не бывает.
 *  Уходит в промт отдельным разделом, помеченным как слова пользователя. */
export default function NoteBox({ value, onChange, state }: Props) {
  const { t } = useI18n();
  return (
    <div className="col gap-8">
      <div className="row gap-8">
        <Icon name="doc" size={15} className="muted" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("note_h")}</span>
        <span className="mono dim" style={{ fontSize: 10.5 }}>{t("note_hint")}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        aria-label={t("note_h")}
        aria-invalid={state.tooLong || undefined}
        style={{
          width: "100%", resize: "vertical", padding: "10px 12px", fontSize: 13.5,
          borderRadius: "var(--r-md)", background: "var(--surface-1)",
          border: `1px solid ${state.tooLong ? "var(--bad)" : "var(--line)"}`,
        }}
      />
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        {state.tooLong && <span style={{ fontSize: 12, color: "var(--bad)" }}>{t("note_over")}</span>}
        <span className="mono dim" style={{ fontSize: 10.5 }}>{value.length} / {NOTE_LIMIT}</span>
      </div>
    </div>
  );
}
