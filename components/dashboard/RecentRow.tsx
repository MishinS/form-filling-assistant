"use client";
import { useState } from "react";
import { FileGlyph, StatusDot, Icon } from "@/components/primitives";
import type { HistoryRow } from "@/lib/seed/pt";

type Props = { r: HistoryRow; tplName: (id: string) => string; onOpen: () => void; last: boolean };

export default function RecentRow({ r, tplName, onOpen, last }: Props) {
  const [h, setH] = useState(false);
  const ext = r.file.split(".").pop()!;
  return (
    <div onClick={onOpen} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "grid", gridTemplateColumns: "2.4fr 1.3fr 1.6fr 1.1fr 1.1fr 1fr 30px",
        gap: 16, padding: "14px 20px", alignItems: "center", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--line)",
        background: h ? "var(--surface-2)" : "transparent", transition: "background .12s" }}>
      <div className="row gap-12" style={{ minWidth: 0 }}>
        <FileGlyph type={ext} size={30} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.file}</div>
          <div className="mono dim" style={{ fontSize: 11 }}>{r.id} · {r.files} {r.files === 1 ? "файл" : "файла"}</div>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{tplName(r.tpl)}</div>
      <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.counter}</div>
      <div className="mono tnum" style={{ fontSize: 13 }}>{r.amount !== "—" ? `${r.amount} ${r.cur}` : <span className="dim">—</span>}</div>
      <div><StatusDot status={r.status} /></div>
      <div className="muted mono" style={{ fontSize: 11.5 }}>{r.date}</div>
      <div style={{ color: h ? "var(--text)" : "var(--text-3)", transition: "color .12s", display: "flex", justifyContent: "flex-end" }}>
        <Icon name="chevR" size={15} />
      </div>
    </div>
  );
}
