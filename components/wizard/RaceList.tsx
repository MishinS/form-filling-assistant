"use client";
import { Icon } from "@/components/primitives";
import { modelLabel, isPaidModel } from "@/lib/extract/llm/catalog";

export type RaceItemStatus = "running" | "win" | "fail";
export interface RaceItem { model: string; status: RaceItemStatus }

const DOT: Record<RaceItemStatus, { color: string; icon: "spin" | "check" | "x" }> = {
  running: { color: "var(--text-3)", icon: "spin" },
  win: { color: "var(--accent)", icon: "check" },
  fail: { color: "var(--bad)", icon: "x" },
};

/** Живой список гоняющихся моделей: спиннер → ✓ (победитель) / ✗ (провал). */
export default function RaceList({ items }: { items: RaceItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="col gap-6" style={{ alignItems: "stretch", maxWidth: 320, margin: "0 auto" }}>
      {items.map((it) => {
        const d = DOT[it.status];
        return (
          <div key={it.model} className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span className="mono" style={{ fontSize: 12, color: it.status === "fail" ? "var(--text-3)" : "var(--text-2)" }}>
              {modelLabel(it.model)}
              {isPaidModel(it.model) && <span className="dim" style={{ fontSize: 10, marginLeft: 6 }}>платная</span>}
            </span>
            <span className={it.status === "running" ? "spin" : ""} style={{ color: d.color, display: "grid", placeItems: "center", width: 16, height: 16 }}>
              <Icon name={d.icon} size={14} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
