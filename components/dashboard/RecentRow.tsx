"use client";
import { useState } from "react";
import Link from "next/link";
import { FileGlyph, StatusDot, Icon } from "@/components/primitives";
import type { StatusKey } from "@/lib/seed/pt";
import type { HistoryRowData } from "@/lib/db/map";

type Props = { r: HistoryRowData; tplName: (id: string) => string; dateText: string; last: boolean };

export default function RecentRow({ r, tplName, dateText, last }: Props) {
  const [h, setH] = useState(false);
  const ext = (r.primaryFile ?? "файл").split(".").pop()!;
  const fileLabel = r.primaryFile ?? "—";
  return (
    <Link href={`/fills/${r.id}`} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "grid", gridTemplateColumns: "2.4fr 1.3fr 1.6fr 1.1fr 1.1fr 1fr 30px",
        gap: 16, padding: "14px 20px", alignItems: "center", textDecoration: "none", color: "inherit",
        borderBottom: last ? "none" : "1px solid var(--line)",
        background: h ? "var(--surface-2)" : "transparent", transition: "background .12s" }}>
      <div className="row gap-12" style={{ minWidth: 0 }}>
        <FileGlyph type={ext} size={30} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileLabel}</div>
          <div className="mono dim" style={{ fontSize: 11 }}>{r.fileCount} {r.fileCount === 1 ? "файл" : "файла"}</div>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{tplName(r.templateId)}</div>
      <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.counterparty ?? <span className="dim">—</span>}</div>
      <div className="mono tnum" style={{ fontSize: 13 }}>{r.amount ? `${r.amount} ${r.currency ?? ""}`.trim() : <span className="dim">—</span>}</div>
      <div><StatusDot status={r.status as StatusKey} /></div>
      <div className="muted mono" style={{ fontSize: 11.5 }}>{dateText}</div>
      <div style={{ color: h ? "var(--text)" : "var(--text-3)", transition: "color .12s", display: "flex", justifyContent: "flex-end" }}>
        <Icon name="chevR" size={15} />
      </div>
    </Link>
  );
}
