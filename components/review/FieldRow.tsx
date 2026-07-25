"use client";
import { useI18n } from "@/lib/i18n";
import { Confidence } from "@/components/primitives";
import type { PtField } from "@/lib/seed/pt";
import type { Attention } from "@/lib/review/attention";
import type { InvalidReason } from "@/lib/review/validate";
import FieldInput from "./FieldInput";
import SourceChip from "./SourceChip";

type Props = {
  f: PtField; val: string; onChange: (v: string) => void;
  confLabel: (lvl: PtField["conf"]) => string;
  hover: string | null; setHover: (id: string | null) => void; last: boolean;
  attention: Attention; reason: InvalidReason | null;
  onEnter: () => void; onFocusField: () => void;
  registerRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

export default function FieldRow({ f, val, onChange, confLabel, hover, setHover, last, attention, reason, onEnter, onFocusField, registerRef }: Props) {
  const { t, lang } = useI18n();
  const inputId = `rv-${f.id}`;
  const errId = `${inputId}-err`;
  // Only `invalid` is explained: `low` is already shown by the Confidence pill in this
  // row, and `required` by the empty input plus the summary banner listing the fields.
  const showReason = attention === "invalid" && reason !== null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,2.4fr) minmax(0,1.5fr) 92px", gap: 14, padding: "13px 16px", alignItems: "center",
      borderBottom: last ? "none" : "1px solid var(--line)", background: attention !== null ? "var(--warn-bg)" : "transparent" }}>
      <div>
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600 }}>{lang === "ru" ? f.label_ru : f.label_en}</label>
        <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>{f.cell}</div>
      </div>
      <div>
        <FieldInput f={f} val={val} onChange={onChange} invalid={attention === "invalid"}
          id={inputId} describedBy={showReason ? errId : undefined}
          onEnter={onEnter} onFocusField={onFocusField} inputRef={registerRef} />
        {showReason && (
          <div id={errId} style={{ fontSize: 11.5, lineHeight: 1.35, marginTop: 5, color: "var(--bad)" }}>
            {t(`review_invalid_${reason}`)}
          </div>
        )}
      </div>
      <div><SourceChip f={f} hover={hover} setHover={setHover} /></div>
      <div className="row gap-6" style={{ justifyContent: "flex-end" }}>
        <Confidence level={f.conf} label={confLabel(f.conf)} />
      </div>
    </div>
  );
}
