"use client";
import { useI18n } from "@/lib/i18n";
import { Confidence } from "@/components/primitives";
import type { PtField } from "@/lib/seed/pt";
import FieldInput from "./FieldInput";
import SourceChip from "./SourceChip";

type Props = {
  f: PtField; val: string; onChange: (v: string) => void;
  confLabel: (lvl: PtField["conf"]) => string;
  hover: string | null; setHover: (id: string | null) => void; last: boolean;
};

export default function FieldRow({ f, val, onChange, confLabel, hover, setHover, last }: Props) {
  const { lang } = useI18n();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,2.4fr) minmax(0,1.5fr) 92px", gap: 14, padding: "13px 16px", alignItems: "center",
      borderBottom: last ? "none" : "1px solid var(--line)", background: f.conf === "low" ? "var(--warn-bg)" : "transparent" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{lang === "ru" ? f.label_ru : f.label_en}</div>
        <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>{f.cell}</div>
      </div>
      <FieldInput f={f} val={val} onChange={onChange} />
      <div><SourceChip f={f} hover={hover} setHover={setHover} /></div>
      <div className="row gap-6" style={{ justifyContent: "flex-end" }}>
        <Confidence level={f.conf} label={confLabel(f.conf)} />
      </div>
    </div>
  );
}
